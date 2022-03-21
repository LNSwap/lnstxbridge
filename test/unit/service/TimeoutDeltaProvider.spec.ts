/* eslint-disable jest/no-commented-out-tests */
import fs from 'fs';
// import toml from '@iarna/toml';
import Logger from '../../../lib/Logger';
import Errors from '../../../lib/service/Errors';
import { ConfigType } from '../../../lib/Config';
import { OrderSide } from '../../../lib/consts/Enums';
import { PairConfig } from '../../../lib/consts/Types';
import TimeoutDeltaProvider from '../../../lib/service/TimeoutDeltaProvider';

const currencies = [
  {
    base: 'BTC',
    quote: 'STX',
    timeoutDelta: 360,
  },
  // {
  //   base: 'LTC',
  //   quote: 'BTC',
  //   timeoutDelta: 20,
  // },
] as any as PairConfig[];

describe('TimeoutDeltaProvider', () => {
  const newDelta = 120;
  const configpath = 'config.toml';

  const cleanup = () => {
    if (fs.existsSync(configpath)) {
      fs.unlinkSync(configpath);
    }
  };

  const deltaProvider = new TimeoutDeltaProvider(Logger.disabledLogger, {
    configpath,
    pairs: [
      {
        base: 'STX',
        quote: 'BTC',
      },
    ],
  } as ConfigType);

  beforeAll(() => {
    cleanup();
  });

  test('should init', () => {
    deltaProvider.init(currencies);

    const deltas = deltaProvider['timeoutDeltas'];

    expect(deltas.size).toEqual(1);

    expect(deltas.get('BTC/STX')).toEqual({
      base: 36,
      quote: 30,
    });
    // expect(deltas.get('LTC/BTC')).toEqual({
    //   base: 8,
    //   quote: 2,
    // });
  });

  test('should not init if no timeout delta was provided', () => {
    expect(() => deltaProvider.init([
      {
        base: 'should',
        quote: 'throw',
      },
    ] as PairConfig[])).toThrow(Errors.NO_TIMEOUT_DELTA('should/throw').message);
  });

  test('should get timeout deltas', () => {
    const pairId = 'BTC/STX';

    expect(deltaProvider.getTimeout(pairId, OrderSide.BUY, true)).toEqual(36);
    expect(deltaProvider.getTimeout(pairId, OrderSide.BUY, false)).toEqual(30);

    expect(deltaProvider.getTimeout(pairId, OrderSide.SELL, true)).toEqual(30);
    expect(deltaProvider.getTimeout(pairId, OrderSide.SELL, false)).toEqual(36);

    // Should throw if pair cannot be found
    const notFound = 'notFound';

    expect(() => deltaProvider.getTimeout(notFound, OrderSide.SELL, true)).toThrow(Errors.PAIR_NOT_FOUND(notFound).message);
  });

  test('should set timeout deltas', () => {
    const pairId = 'BTC/STX';

    deltaProvider.setTimeout(pairId, newDelta);

    expect(deltaProvider['timeoutDeltas'].get(pairId)).toEqual({
      base: 120 / 10,
      quote: 120 / 12,
    });

    // Should throw if pair cannot be found
    const notFound = 'notFound';

    expect(() => deltaProvider.setTimeout(notFound, 20)).toThrow(Errors.PAIR_NOT_FOUND(notFound).message);

    // Should throw if the new delta is invalid
    expect(() => deltaProvider.setTimeout(pairId, -newDelta)).toThrow(Errors.INVALID_TIMEOUT_BLOCK_DELTA().message);
    expect(() => deltaProvider.setTimeout(pairId, 5)).toThrow(Errors.INVALID_TIMEOUT_BLOCK_DELTA().message);
  });

  // test('should write updated timeout deltas to config file', () => {
  //   const writtenConfig = toml.parse(fs.readFileSync(configpath, 'utf-8')) as ConfigType;

  //   expect(writtenConfig.pairs[0].timeoutDelta).toEqual(newDelta);
  // });

  // test('should use Stacks block times if symbols that are not hardcoded are calculated', () => {
  //   const minutesToBlocks = deltaProvider['minutesToBlocks'];

  //   expect(minutesToBlocks('STX/USDA', 1)).toEqual({
  //     base: 4,
  //     quote: 4,
  //   });
  // });

  test('should convert blocks', () => {
    expect(TimeoutDeltaProvider.convertBlocks('STX', 'BTC', 1)).toEqual(2);
    expect(TimeoutDeltaProvider.convertBlocks('STX', 'BTC', 11)).toEqual(14);

    expect(TimeoutDeltaProvider.convertBlocks('BTC', 'STX', 1)).toEqual(1);
    expect(TimeoutDeltaProvider.convertBlocks('BTC', 'STX', 3)).toEqual(3);
  });

  afterAll(() => {
    cleanup();
  });
});
