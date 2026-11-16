import { formatEnergy, formatRate, formatValue, formatWatts, niceMax } from './server-units';

// Intl writes a narrow no-break space before units and between thousands: compared as plain spaces
const plain = (text: string) => text.replace(/[  ]/g, ' ');

describe('server units', () => {
  it('picks a round top for each axis, with room above the curve', () => {
    expect(niceMax([8.4, null, 12], 'W')).toBe(20);
    expect(niceMax([null, null], 'W')).toBe(10);
    expect(niceMax([90], '%')).toBe(100);
    expect(niceMax([35], 'Ko/s')).toBe(100);
  });

  it('writes the values of the curves', () => {
    expect(plain(formatValue(8.43, 'W'))).toBe('8,4 W');
    expect(plain(formatValue(12.5, '%'))).toBe('12,5 %');
    expect(plain(formatValue(380.6, 'Mo'))).toBe('381 Mo');
    expect(plain(formatValue(3.25, 'Ko/s'))).toBe('3,3 Ko/s');
    expect(plain(formatValue(1234.4, 'Mo/h'))).toBe('1 234 Mo/h');
    expect(formatValue(null, 'W')).toBe('—');
  });

  it('writes energy, draw and rates', () => {
    expect(formatEnergy(0.85)).toBe('850 Wh');
    expect(formatEnergy(1.42)).toBe('1,4 kWh');
    expect(formatWatts(21)).toBe('21 W');
    expect(formatWatts(null)).toBe('—');
    expect(formatRate(1536)).toBe('1,5 Ko/s');
    expect(formatRate(undefined)).toBe('—');
  });
});
