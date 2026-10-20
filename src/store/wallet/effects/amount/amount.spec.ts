import configureTestStore from '@test/store';
import {FormatAmount, FromBaseUnits, ToBaseUnits} from './amount';

describe('ToBaseUnits', () => {
  it('should convert everyday amounts of an 18 decimal asset exactly', () => {
    expect(ToBaseUnits(8.54, 18)).toBe('8540000000000000000');
    expect(ToBaseUnits(0.07, 18)).toBe('70000000000000000');
    expect(ToBaseUnits(0.1, 18)).toBe('100000000000000000');
    expect(ToBaseUnits(1.5, 18)).toBe('1500000000000000000');
    expect(ToBaseUnits(1234.5, 18)).toBe('1234500000000000000000');
  });

  it('should convert amounts past 1e21 base units without exponential notation', () => {
    expect(ToBaseUnits(5000000, 18)).toBe('5000000000000000000000000');
    expect(ToBaseUnits(1000, 18)).toBe('1000000000000000000000');
  });

  it('should expand exponential input', () => {
    expect(ToBaseUnits(1e-7, 18)).toBe('100000000000');
    expect(ToBaseUnits(0.00000001, 8)).toBe('1');
  });

  it('should round input carrying more decimals than the asset supports', () => {
    expect(ToBaseUnits(0.1234567, 6)).toBe('123457');
    expect(ToBaseUnits(1234.56789, 6)).toBe('1234567890');
  });

  it('should keep the full precision of a string amount', () => {
    expect(ToBaseUnits('12345678912345678901', 0)).toBe('12345678912345678901');
    expect(ToBaseUnits('8.54', 18)).toBe('8540000000000000000');
  });

  it('should handle assets without decimals and zero', () => {
    expect(ToBaseUnits(123, 0)).toBe('123');
    expect(ToBaseUnits(0, 18)).toBe('0');
  });

  it('should pass through non finite input rather than throwing', () => {
    expect(ToBaseUnits(NaN, 18)).toBe('NaN');
    expect(ToBaseUnits(Infinity, 18)).toBe('Infinity');
  });

  it('should accept raw keypad input without throwing', () => {
    expect(ToBaseUnits('', 18)).toBe('0');
    expect(ToBaseUnits('0.', 18)).toBe('0');
    expect(ToBaseUnits('.5', 18)).toBe('500000000000000000');
    expect(ToBaseUnits('00.5', 18)).toBe('500000000000000000');
    expect(ToBaseUnits(' 1.5 ', 18)).toBe('1500000000000000000');
    expect(ToBaseUnits('1e5', 18)).toBe('100000000000000000000000');
    expect(ToBaseUnits('1.2.3', 18)).toBe('NaN');
  });

  it('should preserve a typed amount that a double cannot hold', () => {
    expect(ToBaseUnits('0.123456789123456789', 18)).toBe('123456789123456789');
    expect(ToBaseUnits('12.345678912345678901', 18)).toBe(
      '12345678912345678901',
    );
    expect(ToBaseUnits('1.000000000000000001', 18)).toBe('1000000000000000001');
  });
});

describe('FromBaseUnits', () => {
  const store = configureTestStore({});

  it('should convert base units to an exact decimal string', () => {
    expect(
      store.dispatch(FromBaseUnits(1282736, 'sol', 'sol', undefined)),
    ).toBe('0.001282736');
    expect(
      store.dispatch(
        FromBaseUnits('1234567891234567891', 'eth', 'eth', undefined),
      ),
    ).toBe('1.234567891234567891');
    expect(
      store.dispatch(FromBaseUnits('0x139270', 'sol', 'sol', undefined)),
    ).toBe('0.001282672');
  });

  it('should drop the decimal point of whole amounts', () => {
    expect(
      store.dispatch(FromBaseUnits(100000000, 'btc', 'btc', undefined)),
    ).toBe('1');
    expect(store.dispatch(FromBaseUnits(0, 'eth', 'eth', undefined))).toBe('0');
  });

  it('should pass through non finite input rather than throwing', () => {
    expect(store.dispatch(FromBaseUnits(NaN, 'sol', 'sol', undefined))).toBe(
      'NaN',
    );
  });

  it('should round a fractional base unit amount', () => {
    expect(store.dispatch(FromBaseUnits(5000.4, 'sol', 'sol', undefined))).toBe(
      '0.000005',
    );
  });
});

describe('FormatAmount', () => {
  const store = configureTestStore({});

  it('should show every significant decimal with full precision', () => {
    expect(
      store.dispatch(FormatAmount('sol', 'sol', undefined, 1282736, true)),
    ).toBe('0.001282736');
    expect(
      store.dispatch(FormatAmount('sol', 'sol', undefined, 5000, true)),
    ).toBe('0.000005');
    expect(
      store.dispatch(FormatAmount('eth', 'eth', undefined, 200000000000, true)),
    ).toBe('0.0000002');
    expect(
      store.dispatch(
        FormatAmount('eth', 'eth', undefined, '1234567891234567891', true),
      ),
    ).toBe('1.234567891234567891');
    expect(
      store.dispatch(FormatAmount('btc', 'btc', undefined, 100000000000, true)),
    ).toBe('1,000.00');
  });

  it('should keep two decimals at least with full precision', () => {
    expect(
      store.dispatch(FormatAmount('btc', 'btc', undefined, 100000000, true)),
    ).toBe('1.00');
    expect(store.dispatch(FormatAmount('btc', 'btc', undefined, 0, true))).toBe(
      '0.00',
    );
    expect(
      store.dispatch(FormatAmount('btc', 'btc', undefined, 50000000, true)),
    ).toBe('0.50');
  });

  it('should not throw on non finite input with full precision', () => {
    expect(
      store.dispatch(FormatAmount('sol', 'sol', undefined, NaN, true)),
    ).toBe('NaN');
  });

  it('should keep the short format capped at six decimals', () => {
    expect(store.dispatch(FormatAmount('sol', 'sol', undefined, 1282736))).toBe(
      '0.001282',
    );
  });
});
