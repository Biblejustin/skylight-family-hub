import { describe, it, expect } from 'vitest';
import { escapeWifiField, buildWifiString } from '../wifi-qr';

describe('escapeWifiField', () => {
  it('returns empty string unchanged', () => {
    expect(escapeWifiField('')).toBe('');
  });

  it('returns plain string unchanged', () => {
    expect(escapeWifiField('MyNetwork')).toBe('MyNetwork');
  });

  it('escapes backslash', () => {
    expect(escapeWifiField('pass\\word')).toBe('pass\\\\word');
  });

  it('escapes semicolon', () => {
    expect(escapeWifiField('pass;word')).toBe('pass\\;word');
  });

  it('escapes comma', () => {
    expect(escapeWifiField('pass,word')).toBe('pass\\,word');
  });

  it('escapes double quote', () => {
    expect(escapeWifiField('pass"word')).toBe('pass\\"word');
  });

  it('escapes colon', () => {
    expect(escapeWifiField('pass:word')).toBe('pass\\:word');
  });

  it('escapes multiple special characters', () => {
    expect(escapeWifiField('my;pass"word\\1')).toBe('my\\;pass\\"word\\\\1');
  });
});

describe('buildWifiString', () => {
  it('builds WPA string with password', () => {
    expect(buildWifiString('Home', 'secret123', 'WPA', false))
      .toBe('WIFI:T:WPA;S:Home;P:secret123;H:false;;');
  });

  it('builds WEP string with password', () => {
    expect(buildWifiString('Home', 'abcde', 'WEP', false))
      .toBe('WIFI:T:WEP;S:Home;P:abcde;H:false;;');
  });

  it('builds nopass string without password', () => {
    expect(buildWifiString('CafeWifi', 'ignored', 'nopass', false))
      .toBe('WIFI:T:nopass;S:CafeWifi;P:;H:false;;');
  });

  it('sets hidden flag to true', () => {
    expect(buildWifiString('Secret', 'pw', 'WPA', true))
      .toBe('WIFI:T:WPA;S:Secret;P:pw;H:true;;');
  });

  it('escapes special characters in SSID and password', () => {
    expect(buildWifiString('My;Net', 'p"a:ss', 'WPA', false))
      .toBe('WIFI:T:WPA;S:My\\;Net;P:p\\"a\\:ss;H:false;;');
  });

  it('handles empty SSID and password', () => {
    expect(buildWifiString('', '', 'WPA', false))
      .toBe('WIFI:T:WPA;S:;P:;H:false;;');
  });
});
