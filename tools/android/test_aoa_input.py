"""Pure unit tests: these never initialize libusb or touch a USB device."""
import contextlib
import io
import struct
import unittest

import aoa_input as aoa


class AoaInputTests(unittest.TestCase):
    def test_power_is_bounded_and_unregisters(self):
        calls, sleeps = [], []
        aoa.power_menu(lambda request, **kwargs: calls.append((request, kwargs)), sleeps.append)
        self.assertEqual(sleeps, [2, 1.8, 1])
        self.assertEqual([request for request, _ in calls], [54, 56, 57, 57, 57, 55])
        self.assertEqual(calls[2][1]["data"], b"\x01")
        self.assertEqual(calls[3][1]["data"], b"\x00")
        self.assertEqual(calls[0][1]["index"], len(aoa.POWER_DESCRIPTOR))

    def test_gesture_uses_two_contacts_and_releases(self):
        calls = []
        aoa.two_finger(lambda request, **kwargs: calls.append((request, kwargs)),
                       (0.9995, 0.42), (0.65, 0.42), lambda _: None)
        reports = [kwargs["data"] for request, kwargs in calls if request == 57]
        self.assertEqual(len(reports), 33)
        self.assertTrue(all(len(report) == 13 for report in reports))
        initial = struct.unpack("<BBHHBBHHB", reports[0])
        self.assertEqual((initial[0], initial[1], initial[4], initial[5], initial[-1]), (1, 0, 1, 1, 2))
        final = struct.unpack("<BBHHBBHHB", reports[-1])
        self.assertEqual((final[0], final[4]), (0, 0))
        self.assertEqual(final[2], round(0.65 * 32767))
        self.assertEqual(calls[-1][0], 55)

    def test_invalid_coordinates_send_nothing(self):
        calls = []
        with self.assertRaises(ValueError):
            aoa.two_finger(lambda *args, **kwargs: calls.append(args), (1.1, 0), (0, 0))
        self.assertEqual(calls, [])

    def test_descriptor_failure_still_unregisters(self):
        calls = []
        def send(request, **kwargs):
            calls.append(request)
            if request == 56:
                raise RuntimeError("descriptor rejected")
        with self.assertRaisesRegex(RuntimeError, "descriptor rejected"):
            aoa.power_menu(send, lambda _: None)
        self.assertEqual(calls, [54, 56, 57, 55])

    def test_release_failure_still_unregisters(self):
        calls = []
        def send(request, **kwargs):
            calls.append(request)
            if request == 57:
                raise RuntimeError("disconnected")
        with contextlib.redirect_stderr(io.StringIO()):
            with aoa.temporary_hid(send, b"descriptor", lambda: b"\0"):
                pass
        self.assertEqual(calls, [54, 56, 57, 55])

    def test_input_requires_explicit_serial(self):
        with self.assertRaisesRegex(SystemExit, "requires --serial"):
            aoa.main(["power-menu"])

    def test_default_coordinates_match_observed_route(self):
        args = aoa.parser().parse_args(["--serial", "EXAMPLE", "two-finger"])
        self.assertEqual(args.start, (0.9995, 0.42))
        self.assertEqual(args.end, (0.65, 0.42))


if __name__ == "__main__":
    unittest.main()
