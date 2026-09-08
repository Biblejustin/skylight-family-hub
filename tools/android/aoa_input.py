#!/usr/bin/env python3
"""Bounded pre-ADB input for the tested Skylight 150-CAL USB interfaces.

Requires Python 3 and libusb 1.0. No USB mode switches, hub resets, filesystem
access, settings changes, or automated repetition. Run each action while watching
the screen. USB identifiers are discovered locally and never stored by this tool.
"""
import argparse
import ctypes as c
import ctypes.util
import struct
import sys
import time
from contextlib import contextmanager


KNOWN_INTERFACES = {(0x2207, 0x0007), (0x18D1, 0x0007), (0x18D1, 0x2D00)}
POWER_DESCRIPTOR = bytes.fromhex(
    "050c0901a101093015002501750195018102750795018101c0")
TOUCH_DESCRIPTOR = bytes.fromhex(
    "050d0904a101050d0922a10215002501750895010942810209518102"
    "05010930093126ff7f751095028102c0050d0922a102150025017508"
    "9501094281020951810205010930093126ff7f751095028102c0050d"
    "09542502750895018102c0")


class UsbDescriptor(c.Structure):
    _fields_ = [
        ("bLength", c.c_uint8), ("bDescriptorType", c.c_uint8),
        ("bcdUSB", c.c_uint16), ("bDeviceClass", c.c_uint8),
        ("bDeviceSubClass", c.c_uint8), ("bDeviceProtocol", c.c_uint8),
        ("bMaxPacketSize0", c.c_uint8), ("idVendor", c.c_uint16),
        ("idProduct", c.c_uint16), ("bcdDevice", c.c_uint16),
        ("iManufacturer", c.c_uint8), ("iProduct", c.c_uint8),
        ("iSerialNumber", c.c_uint8), ("bNumConfigurations", c.c_uint8),
    ]


class Usb:
    def __init__(self, library=None):
        library = library or ctypes.util.find_library("usb-1.0")
        if not library:
            raise RuntimeError("libusb 1.0 not found. Install it or supply --libusb PATH.")
        self.lib = c.CDLL(library)
        declarations = {
            "libusb_init": ([c.POINTER(c.c_void_p)], c.c_int),
            "libusb_exit": ([c.c_void_p], None),
            "libusb_get_device_list": ([c.c_void_p, c.POINTER(c.POINTER(c.c_void_p))], c.c_ssize_t),
            "libusb_free_device_list": ([c.POINTER(c.c_void_p), c.c_int], None),
            "libusb_get_device_descriptor": ([c.c_void_p, c.POINTER(UsbDescriptor)], c.c_int),
            "libusb_open": ([c.c_void_p, c.POINTER(c.c_void_p)], c.c_int),
            "libusb_close": ([c.c_void_p], None),
            "libusb_get_string_descriptor_ascii": ([c.c_void_p, c.c_uint8, c.POINTER(c.c_ubyte), c.c_int], c.c_int),
            "libusb_control_transfer": ([c.c_void_p, c.c_uint8, c.c_uint8, c.c_uint16,
                                         c.c_uint16, c.POINTER(c.c_ubyte), c.c_uint16, c.c_uint], c.c_int),
        }
        for name, (arguments, result) in declarations.items():
            function = getattr(self.lib, name)
            function.argtypes, function.restype = arguments, result
        self.context = c.c_void_p()
        result = self.lib.libusb_init(c.byref(self.context))
        if result:
            raise RuntimeError(f"libusb initialization failed: {result}")

    def close(self):
        self.lib.libusb_exit(self.context)

    @contextmanager
    def candidates(self):
        devices = c.POINTER(c.c_void_p)()
        count = self.lib.libusb_get_device_list(self.context, c.byref(devices))
        if count < 0:
            raise RuntimeError(f"Cannot list USB devices: {count}")
        opened = []
        try:
            for index in range(count):
                descriptor = UsbDescriptor()
                if self.lib.libusb_get_device_descriptor(devices[index], c.byref(descriptor)):
                    continue
                pair = (descriptor.idVendor, descriptor.idProduct)
                if pair not in KNOWN_INTERFACES:
                    continue
                handle = c.c_void_p()
                result = self.lib.libusb_open(devices[index], c.byref(handle))
                if result:
                    print(f"Cannot open matching {pair[0]:04x}:{pair[1]:04x}: USB error {result}", file=sys.stderr)
                    continue
                opened.append(handle)
                buffer = (c.c_ubyte * 256)()
                length = self.lib.libusb_get_string_descriptor_ascii(
                    handle, descriptor.iSerialNumber, buffer, len(buffer)) if descriptor.iSerialNumber else -1
                if length <= 0:
                    continue
                serial = bytes(buffer[:length]).decode("utf-8", errors="strict")
                # Copy descriptor values; do not retain borrowed device-list pointers.
                opened[-1] = (handle, serial, pair)
            yield [entry for entry in opened if isinstance(entry, tuple)]
        finally:
            for entry in opened:
                self.lib.libusb_close(entry[0] if isinstance(entry, tuple) else entry)
            self.lib.libusb_free_device_list(devices, 1)

    def send(self, handle, request, hid_id, index=0, data=b""):
        buffer = (c.c_ubyte * len(data)).from_buffer_copy(data) if data else None
        result = self.lib.libusb_control_transfer(
            handle, 0x40, request, hid_id, index, buffer, len(data), 1000)
        if result != len(data):
            raise RuntimeError(f"USB request {request} returned {result}; expected {len(data)}")


@contextmanager
def temporary_hid(send, descriptor, release):
    registered = False
    try:
        send(54, index=len(descriptor))
        registered = True
        send(56, data=descriptor)
        yield
    finally:
        if registered:
            try:
                send(57, data=release())
            except RuntimeError as error:
                print(f"Release failed: {error}", file=sys.stderr)
            # Attempt unregister independently, even if release failed.
            try:
                send(55)
            except RuntimeError as error:
                print(f"Unregister failed: {error}", file=sys.stderr)


def power_menu(send, sleep=time.sleep):
    with temporary_hid(send, POWER_DESCRIPTOR, lambda: bytes(1)):
        sleep(2)
        send(57, data=b"\x01")
        sleep(1.8)
        send(57, data=bytes(1))
        sleep(1)


def touch_report(tip, x, y):
    return struct.pack("<BBHHBBHHB", tip, 0, x, y,
                       tip, 1, x, min(32767, y + round(0.16 * 32767)), 2)


def two_finger(send, start, end, sleep=time.sleep):
    if any(not 0 <= value <= 1 for value in (*start, *end)):
        raise ValueError("Touch coordinates must be between 0 and 1")
    x, y = round(start[0] * 32767), round(start[1] * 32767)
    with temporary_hid(send, TOUCH_DESCRIPTOR, lambda: touch_report(0, x, y)):
        sleep(1)
        send(57, data=touch_report(1, x, y))
        initial_x, initial_y = x, y
        for step in range(1, 31):
            x = round(initial_x + (end[0] * 32767 - initial_x) * step / 30)
            y = round(initial_y + (end[1] * 32767 - initial_y) * step / 30)
            send(57, data=touch_report(1, x, y))
            sleep(0.015)
        sleep(1)
        send(57, data=touch_report(0, x, y))
        sleep(0.62)


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--libusb", help="Explicit libusb 1.0 shared library path")
    result.add_argument("--serial", help="Required exact target serial for input actions")
    commands = result.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="Read-only list of matching USB interfaces and serials")
    commands.add_parser("power-menu", help="Hold consumer power key for 1.8 seconds, then release")
    touch = commands.add_parser("two-finger", help="One bounded gesture; default matches tested portrait 150-CAL")
    touch.add_argument("--start", type=float, nargs=2, default=(0.9995, 0.42), metavar=("X", "Y"))
    touch.add_argument("--end", type=float, nargs=2, default=(0.65, 0.42), metavar=("X", "Y"))
    return result


def main(argv=None):
    arguments = parser().parse_args(argv)
    if arguments.command != "list" and not arguments.serial:
        raise SystemExit("Input requires --serial from the read-only list command.")
    if arguments.command == "two-finger" and any(not 0 <= value <= 1 for value in (*arguments.start, *arguments.end)):
        raise SystemExit("Touch coordinates must be between 0 and 1")
    usb = Usb(arguments.libusb)
    try:
        with usb.candidates() as devices:
            if arguments.command == "list":
                for _, serial, (vendor, product) in devices:
                    print(f"{vendor:04x}:{product:04x}  {serial}")
                if not devices:
                    print("No readable matching pre-ADB interface. Check cable, power, and USB access.")
                return
            targets = [device for device in devices if device[1] == arguments.serial]
            if len(targets) != 1:
                raise RuntimeError("Expected exactly one matching target serial; no input sent.")
            handle = targets[0][0]
            hid_id = 11 if arguments.command == "power-menu" else 12
            send = lambda request, index=0, data=b"": usb.send(handle, request, hid_id, index, data)
            if arguments.command == "power-menu":
                power_menu(send)
            else:
                two_finger(send, arguments.start, arguments.end)
            print("Input sent; temporary HID released. Check the screen before another action.")
    finally:
        usb.close()


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError) as error:
        raise SystemExit(str(error)) from error
