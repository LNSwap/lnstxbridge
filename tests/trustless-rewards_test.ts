import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const CONTRACT_NAME = 'trustless-rewards';
const CONTRACT_EXT = '.trustless-rewards';
const CREATE_FNC = 'create-lobby';
const JOIN_FNC = 'join';
const DISABLE_FNC = 'disable-lobby';
const PUBLISH_MANY_FNC = 'publish-result-many';
const FINISH_MANY_FNC = 'finish-result-many';
const GET_SCORE_FNC = 'get-score';
const GET_LOBBY_FNC = 'get-lobby';
const TRANSFER_STX_FNC = 'transfer-stx';
const TRANSFER_FT_FNC = 'transfer-ft-token';
const TRANSFER_NFT_FNC = 'transfer-nft-token';
const SET_OWNER_FNC = 'set-owner';

// errors
const ERR_NOT_AUTHORIZED = 401;
const ERR_NOT_FOUND = 404;
const ERR_NOT_ACTIVE = 403;
const ERR_ALREADY_JOINED = 405;
const ERR_JOIN_FAILED = 500;
const OK_SUCCES = 200;
const DEFAULT_PRICE = 100;

const lobbyMap = 'bigApple';
const lobbyLength = 'normal';
const lobbyTraffic = 'intense';
const lobbyCurves = 'straight';
const lobbyHours = 2;

function stxToMilistx(nr: number): number {
  return nr * 1000000;
}

// Clarinet.test({
//   name: 'Ensure that user 1 can transfer stx to user 2',
//   async fn(chain: Chain, accounts: Map<string, Account>) {
//     const deployer = accounts.get('deployer')!;
//     const wallet_1 = accounts.get('wallet_1')!;
//     const wallet_2 = accounts.get('wallet_2')!;
//     const old_wallet2_balance = wallet_2.balance;
//     let block = chain.mineBlock([
//       Tx.contractCall(
//         CONTRACT_NAME,
//         'fund-address',
//         [
//           // principalCV(receiverWallet), uintCV(toMiliSTX(amount)
//           types.principal(wallet_2.address), // price
//           types.uint(5000), // factor
//         ],
//         wallet_1.address
//       ),
//     ]);
//     // console.log(`block `, block);
//     // block.receipts[0].result.expectOk().expectUint(1);

//     // assertEquals(
//     //   tx.result,
//     //   `(ok {active: true, balance: u5, commission: u5, curves: "${lobbyCurves}", description: "lobby description", factor: u5, length: "${lobbyLength}", mapy: "${lobbyMap}", owner: ${deployer.address}, price: u5, traffic: "${lobbyTraffic}"})`
//     // );
//     console.log(wallet_1.balance);
//     assertEquals(wallet_2.balance, old_wallet2_balance + 5000);
//   },
// });

Clarinet.test({
  name: 'Ensure that owner can create a lobby',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;

    let block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`), // description
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap),
          types.ascii(lobbyLength),
          types.ascii(lobbyTraffic),
          types.ascii(lobbyCurves),
          types.uint(lobbyHours),
        ],
        deployer.address
      ),
    ]);
    // console.log(`block `, block);
    block.receipts[0].result.expectOk().expectUint(1);

    const tx = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_LOBBY_FNC,
      [
        types.uint(1), // lobby id
      ],
      deployer.address
    );
    assertEquals(
      tx.result,
      `(ok {active: true, balance: u5, commission: u5, curves: "${lobbyCurves}", description: "lobby description", factor: u5, hours: u${lobbyHours}, length: "${lobbyLength}", mapy: "${lobbyMap}", owner: ${deployer.address}, price: u5, traffic: "${lobbyTraffic}"})`
    );
  },
});

Clarinet.test({
  name: 'Ensure that contract-owner can disable a lobby created by another user, users can not join after disabled',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;

    // w1 create lobby
    // deployer disable it
    // w2 can not join
    let block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`), // description
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), // hours
        ],
        wallet_1.address
      ),
    ]);
    // console.log(`block `, block);
    block.receipts[0].result.expectOk().expectUint(1);

    const tx = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_LOBBY_FNC,
      [
        types.uint(1), // lobby id
      ],
      deployer.address
    );
    assertEquals(
      tx.result,
      `(ok {active: true, balance: u5, commission: u5, curves: "${lobbyCurves}", description: "lobby description", factor: u5, hours: u${lobbyHours}, length: "${lobbyLength}", mapy: "${lobbyMap}", owner: ${wallet_1.address}, price: u5, traffic: "${lobbyTraffic}"})`
    );

    let block2 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        DISABLE_FNC,
        [
          types.uint(1), // lobby id
        ],
        deployer.address
      ),
    ]);
    // console.log(`block2 `, block2);
    block2.receipts[0].result.expectOk().expectBool(true);

    let block3 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_2.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        deployer.address
      ),
    ]);
    const tx2 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_LOBBY_FNC,
      [
        types.uint(1), // lobby id
      ],
      deployer.address
    );
    assertEquals(
      tx2.result,
      `(ok {active: false, balance: u5, commission: u5, curves: "${lobbyCurves}", description: "lobby description", factor: u5, hours: u${lobbyHours}, length: "${lobbyLength}", mapy: "${lobbyMap}", owner: ${wallet_1.address}, price: u5, traffic: "${lobbyTraffic}"})`
    );
    // console.log(`block2 `, block2.receipts[0].events);
    block3.receipts[0].result.expectErr().expectUint(ERR_NOT_ACTIVE);
    block3.receipts[1].result.expectErr().expectUint(ERR_NOT_ACTIVE);
  },
});

Clarinet.test({
  name: 'Ensure that anyone can join a lobby, pay entry price, check run details',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;

    let block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), // hours
        ],
        deployer.address
      ),
    ]);
    // console.log(`block `, block.receipts[0].events);
    block.receipts[0].result.expectOk().expectUint(1);

    // // no more needed because create includes join
    // let block2 = chain.mineBlock([
    //     Tx.contractCall(
    //         CONTRACT_NAME,
    //         JOIN_FNC,
    //         [
    //           types.uint(1), // lobby id
    //         ],
    //         wallet_1.address
    //     )
    // ]);
    // console.log(`block2 `, block2.receipts[0].events);
    // block2.receipts[0].result.expectOk().expectUint(OK_SUCCES);
    // assertEquals(block2.receipts[0].events[0]["stx_transfer_event"]["amount"], "5");

    const tx = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(deployer.address),
      ],
      wallet_1.address
    );
    // console.log(`tx `, tx);
    assertEquals(
      tx.result,
      '(ok {nft: "", rac: u0, rank: u0, rank-factor: u0, rewards: u0, score: u0, sum-rank-factor: u0})'
    );
  },
});

Clarinet.test({
  name: 'Ensure that anyone can join a lobby only once',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;

    let block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), // hours
        ],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk().expectUint(1);

    let block2 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_1.address
      ),
    ]);
    // console.log(`block2 `, block2.receipts[0].events);
    block2.receipts[0].result.expectOk().expectUint(OK_SUCCES);
    assertEquals(block2.receipts[0].events[0]['stx_transfer_event']['amount'], '5');

    let block3 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_1.address
      ),
    ]);
    // console.log(`block3 `, block3.receipts[0].events);
    block3.receipts[0].result.expectErr().expectUint(ERR_ALREADY_JOINED);

    const tx = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // run-id
        types.principal(wallet_1.address),
      ],
      wallet_1.address
    );
    // console.log(`tx `, tx);
    assertEquals(
      tx.result,
      '(ok {nft: "", rac: u0, rank: u0, rank-factor: u0, rewards: u0, score: u0, sum-rank-factor: u0})'
    );
  },
});

Clarinet.test({
  name: 'Ensure that owner can publish results for an existing lobby that users have joined',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;
    const wallet_3 = accounts.get('wallet_3')!;
    const walletAddressArray = [wallet_1.address, wallet_2.address, wallet_3.address];

    let block1 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), // hours
        ],
        deployer.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_1.address
      ),
    ]);
    block1.receipts[0].result.expectOk().expectUint(1);

    let block2 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_2.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_3.address
      ),
    ]);
    // console.log(`block2 `, block2.receipts[0].events);
    block2.receipts[0].result.expectOk().expectUint(OK_SUCCES);
    assertEquals(block2.receipts[0].events[0]['stx_transfer_event']['amount'], '5');
    assertEquals(block2.receipts[1].events[0]['stx_transfer_event']['amount'], '5');

    // (run-result (list 50 { lobby-id: uint, run-id: uint, address: principal, score: uint, rank: uint, rank-factor: uint, rewards: uint, rac: uint})))
    const publishManyRecords: any[] = [];
    let testarray = [...Array(3).keys()].map((x) => x + 1);
    testarray.forEach((id) => {
      let record = {
        'lobby-id': 1,
        // 'run-id': id,
        address: walletAddressArray[id - 1],
        score: 10,
        rank: id,
        'sum-rank-factor': 0,
        'rank-factor': 3048625,
        rewards: 2000000,
        rac: 1800000,
        nft: 'nft:1',
      };
      publishManyRecords.push(record);
    });
    // console.log('publishManyRecords ', publishManyRecords);
    const args = types.list(
      publishManyRecords.map((record) => {
        return types.tuple({
          'lobby-id': types.uint(record['lobby-id']),
          // 'run-id': types.uint(record['run-id']),
          address: types.principal(record.address),
          score: types.uint(record['score']),
          rank: types.uint(record['rank']),
          'sum-rank-factor': types.uint(record['sum-rank-factor']),
          'rank-factor': types.uint(record['rank-factor']),
          rewards: types.uint(record['rewards']),
          rac: types.uint(record['rac']),
          nft: types.ascii(record['nft']),
        });
      })
    );
    // console.log('args ', args);
    let block = chain.mineBlock([Tx.contractCall(CONTRACT_NAME, PUBLISH_MANY_FNC, [args], deployer.address)]);
    // console.log('block ', block, block.receipts[0].events);
    block.receipts[0].result.expectOk().expectBool(true);
  },
});

// finish results and distribute rewards
Clarinet.test({
  name: 'Ensure that contract-owner can finish results and distribute rewards for an existing lobby that users have joined',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;
    const wallet_3 = accounts.get('wallet_3')!;
    const walletAddressArray = [wallet_1.address, wallet_2.address, wallet_3.address];

    let block1 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), // hours
        ],
        deployer.address
      ),
    ]);
    block1.receipts[0].result.expectOk().expectUint(1);

    let block2 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_1.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_2.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_3.address
      ),
    ]);
    // console.log(`block2 `, block2.receipts[0].events);
    block2.receipts[0].result.expectOk().expectUint(OK_SUCCES);
    block2.receipts[1].result.expectOk().expectUint(OK_SUCCES);
    block2.receipts[2].result.expectOk().expectUint(OK_SUCCES);
    assertEquals(block2.receipts[0].events[0]['stx_transfer_event']['amount'], '5');
    assertEquals(block2.receipts[1].events[0]['stx_transfer_event']['amount'], '5');
    assertEquals(block2.receipts[2].events[0]['stx_transfer_event']['amount'], '5');

    // (run-result (list 50 { lobby-id: uint, address: principal, score: uint, rank: uint, rank-factor: uint, rewards: uint, rac: uint})))
    const publishManyRecords: any[] = [];
    let testarray = [...Array(3).keys()].map((x) => x + 1);
    testarray.forEach((id) => {
      let record = {
        'lobby-id': 1,
        // 'run-id': id,
        address: walletAddressArray[id - 1],
        score: 10,
        rank: id,
        'sum-rank-factor': 0,
        'rank-factor': 15,
        rewards: 5,
        rac: 4,
        nft: 'nft1',
      };
      publishManyRecords.push(record);
    });

    // console.log('publishManyRecords ', publishManyRecords);
    const args = types.list(
      publishManyRecords.map((record) => {
        return types.tuple({
          'lobby-id': types.uint(record['lobby-id']),
          // 'run-id': types.uint(record['run-id']),
          address: types.principal(record.address),
          score: types.uint(record['score']),
          rank: types.uint(record['rank']),
          'sum-rank-factor': types.uint(record['sum-rank-factor']),
          'rank-factor': types.uint(record['rank-factor']),
          rewards: types.uint(record['rewards']),
          rac: types.uint(record['rac']),
          nft: types.ascii(record['nft']),
        });
      })
    );
    // console.log('args ', args);
    let block = chain.mineBlock([Tx.contractCall(CONTRACT_NAME, FINISH_MANY_FNC, [args], deployer.address)]);
    block.receipts[0].result.expectOk().expectBool(true);
    assertEquals(block.receipts[0].events[0].stx_transfer_event.amount, '4'); // 4 = rac value provided by owner
  },
});

// runtime error
// failure cases
Clarinet.test({
  name: 'Ensure that owner can not publish results for a non-existent run',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;

    // (run-result (list 50 { lobby-id: uint, run-id: uint, address: principal, score: uint, rank: uint, rank-factor: uint, rewards: uint, rac: uint})))
    const publishManyRecords: any[] = [];
    let testarray = [...Array(3).keys()].map((x) => x + 1);
    testarray.forEach((id) => {
      let record = {
        'lobby-id': id,
        // 'run-id': id,
        address: wallet_1.address,
        score: 10,
        rank: 1,
        'sum-rank-factor': 0,
        'rank-factor': 15,
        rewards: 123,
        rac: 321,
        nft: 'nft:1',
      };
      publishManyRecords.push(record);
    });
    // console.log('publishManyRecords ', publishManyRecords);
    const args = types.list(
      publishManyRecords.map((record) => {
        return types.tuple({
          'lobby-id': types.uint(record['lobby-id']),
          // 'run-id': types.uint(record['run-id']),
          address: types.principal(record.address),
          score: types.uint(record['score']),
          rank: types.uint(record['rank']),
          'sum-rank-factor': types.uint(record['sum-rank-factor']),
          'rank-factor': types.uint(record['rank-factor']),
          rewards: types.uint(record['rewards']),
          rac: types.uint(record['rac']),
          nft: types.ascii(record['nft']),
        });
      })
    );
    // console.log('args ', args);
    let block = chain.mineBlock([Tx.contractCall(CONTRACT_NAME, PUBLISH_MANY_FNC, [args], deployer.address)]);
    // console.log('block ', block);
    assertEquals(block.receipts.length, 0);
    // block.receipts[0].result.expectOk().expectUint(1);
  },
});

Clarinet.test({
  name: 'Ensure that anyone can create lobbies',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;
    const wallet_3 = accounts.get('wallet_3')!;
    const walletAddressArray = [wallet_1.address, wallet_2.address, wallet_3.address];

    let block1 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), // hours
        ],
        wallet_1.address
      ),
    ]);
    block1.receipts[0].result.expectOk().expectUint(1);
  },
});

Clarinet.test({
  name: 'Ensure that non-owner can not publish results for an existing lobby that users have joined',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;
    const wallet_3 = accounts.get('wallet_3')!;
    const walletAddressArray = [wallet_1.address, wallet_2.address, wallet_3.address];

    let block1 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), // hours
        ],
        deployer.address
      ),
    ]);
    block1.receipts[0].result.expectOk().expectUint(1);

    let block2 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_1.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_2.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_3.address
      ),
    ]);
    // console.log(`block2 `, block2.receipts[0].events);
    block2.receipts[0].result.expectOk().expectUint(OK_SUCCES);
    assertEquals(block2.receipts[0].events[0]['stx_transfer_event']['amount'], '5');

    // (run-result (list 50 { lobby-id: uint, run-id: uint, address: principal, score: uint, rank: uint, rank-factor: uint, rewards: uint, rac: uint})))
    const publishManyRecords: any[] = [];
    let testarray = [...Array(3).keys()].map((x) => x + 1);
    testarray.forEach((id) => {
      let record = {
        'lobby-id': 1,
        // 'run-id': id,
        address: walletAddressArray[id - 1],
        score: 10,
        rank: id,
        'sum-rank-factor': 0,
        'rank-factor': 15,
        rewards: 5,
        rac: 4,
        nft: 'nft:1',
      };
      publishManyRecords.push(record);
    });
    // console.log('publishManyRecords ', publishManyRecords);
    const args = types.list(
      publishManyRecords.map((record) => {
        return types.tuple({
          'lobby-id': types.uint(record['lobby-id']),
          // 'run-id': types.uint(record['run-id']),
          address: types.principal(record.address),
          score: types.uint(record['score']),
          rank: types.uint(record['rank']),
          'sum-rank-factor': types.uint(record['sum-rank-factor']),
          'rank-factor': types.uint(record['rank-factor']),
          rewards: types.uint(record['rewards']),
          rac: types.uint(record['rac']),
          nft: types.ascii(record['nft']),
        });
      })
    );
    // console.log('args ', args);
    let block = chain.mineBlock([Tx.contractCall(CONTRACT_NAME, PUBLISH_MANY_FNC, [args], wallet_1.address)]);
    // console.log('block ', block.receipts[0].events);
    block.receipts[0].result.expectErr().expectUint(ERR_NOT_AUTHORIZED);
  },
});

Clarinet.test({
  name: 'Ensure that non-owner can not finish results and distribute rewards for an existing lobby that users have joined',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;
    const wallet_3 = accounts.get('wallet_3')!;
    const walletAddressArray = [wallet_1.address, wallet_2.address, wallet_3.address];

    let block1 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), //hours
        ],
        deployer.address
      ),
    ]);
    block1.receipts[0].result.expectOk().expectUint(1);

    let block2 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_1.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_2.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_3.address
      ),
    ]);
    // console.log(`block2 `, block2.receipts[0].events);
    block2.receipts[0].result.expectOk().expectUint(OK_SUCCES);
    assertEquals(block2.receipts[0].events[0]['stx_transfer_event']['amount'], '5');

    // (run-result (list 50 { lobby-id: uint, run-id: uint, address: principal, score: uint, rank: uint, rank-factor: uint, rewards: uint, rac: uint})))
    const publishManyRecords: any[] = [];
    let testarray = [...Array(3).keys()].map((x) => x + 1);
    testarray.forEach((id) => {
      let record = {
        'lobby-id': 1,
        // 'run-id': id,
        address: walletAddressArray[id - 1],
        score: 10,
        rank: id,
        'sum-rank-factor': 0,
        'rank-factor': 15,
        rewards: 5,
        rac: 4,
        nft: 'nft:1',
      };
      publishManyRecords.push(record);
    });
    // console.log('publishManyRecords ', publishManyRecords);
    const args = types.list(
      publishManyRecords.map((record) => {
        return types.tuple({
          'lobby-id': types.uint(record['lobby-id']),
          // 'run-id': types.uint(record['run-id']),
          address: types.principal(record.address),
          score: types.uint(record['score']),
          rank: types.uint(record['rank']),
          'sum-rank-factor': types.uint(record['sum-rank-factor']),
          'rank-factor': types.uint(record['rank-factor']),
          rewards: types.uint(record['rewards']),
          rac: types.uint(record['rac']),
          nft: types.ascii(record['nft']),
        });
      })
    );
    // console.log('args ', args);
    let block = chain.mineBlock([Tx.contractCall(CONTRACT_NAME, FINISH_MANY_FNC, [args], wallet_1.address)]);
    // console.log('block ', block.receipts[0].events);
    block.receipts[0].result.expectErr().expectUint(ERR_NOT_AUTHORIZED);
  },
});

Clarinet.test({
  // see tnhis
  name: 'Ensure that non-contract-owner can not disable lobbies',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;
    const wallet_3 = accounts.get('wallet_3')!;
    const walletAddressArray = [wallet_1.address, wallet_2.address, wallet_3.address];
    // w2 creates lobby
    // w1 join lobby, w3 try disable lobby
    // w1 try disable lobby
    // w2 - lobby owner - try disable lobby
    // lobby still active
    let block1 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), //hours
        ],
        wallet_2.address
      ),
    ]);
    block1.receipts[0].result.expectOk().expectUint(1);

    let block2 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_1.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        DISABLE_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_3.address
      ),
    ]);
    // console.log(`block2 `, block2.receipts[0].events);
    block2.receipts[0].result.expectOk().expectUint(OK_SUCCES);
    assertEquals(block2.receipts[0].events[0]['stx_transfer_event']['amount'], '5');
    block2.receipts[1].result.expectErr().expectUint(ERR_NOT_AUTHORIZED);

    let block3 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        DISABLE_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_1.address
      ),
    ]);
    block3.receipts[0].result.expectErr().expectUint(ERR_NOT_AUTHORIZED);

    let block4 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        DISABLE_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_2.address
      ),
    ]);
    block4.receipts[0].result.expectErr().expectUint(ERR_NOT_AUTHORIZED);
    // check lobby-id u1 active true
    let block5 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        GET_LOBBY_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_2.address
      ),
    ]);
    const tx = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_LOBBY_FNC,
      [
        types.uint(1), // lobby id
      ],
      deployer.address
    );
    assertEquals(
      tx.result,
      `(ok {active: true, balance: u10, commission: u5, curves: "${lobbyCurves}", description: "lobby description", factor: u5, hours: u${lobbyHours}, length: "${lobbyLength}", mapy: "${lobbyMap}", owner: ${wallet_2.address}, price: u5, traffic: "${lobbyTraffic}"})`
    );
  },
});

// safety functions
Clarinet.test({
  name: 'Ensure that owner can transfer stx from contract',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;

    let block1 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), //hours
        ],
        deployer.address
      ),
    ]);
    block1.receipts[0].result.expectOk().expectUint(1);

    let block2 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_1.address
      ),
    ]);
    // console.log(`block2 `, block2.receipts[0].events);
    block2.receipts[0].result.expectOk().expectUint(OK_SUCCES);
    assertEquals(block2.receipts[0].events[0]['stx_transfer_event']['amount'], '5');

    let block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        TRANSFER_STX_FNC,
        [
          types.principal(wallet_1.address),
          types.uint(5), // lobby id
        ],
        deployer.address
      ),
    ]);
    // console.log('block ', block.receipts[0].events);
    block.receipts[0].result.expectOk().expectBool(true);
    assertEquals(block2.receipts[0].events[0]['stx_transfer_event']['amount'], '5');
  },
});

Clarinet.test({
  name: 'Ensure that non-owner users can not transfer stx from contract',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;

    let block1 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), //hours
        ],
        deployer.address
      ),
    ]);
    block1.receipts[0].result.expectOk().expectUint(1);

    let block2 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_1.address
      ),
    ]);
    // console.log(`block2 `, block2.receipts[0].events);
    block2.receipts[0].result.expectOk().expectUint(OK_SUCCES);
    assertEquals(block2.receipts[0].events[0]['stx_transfer_event']['amount'], '5');

    let block = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        TRANSFER_STX_FNC,
        [
          types.principal(wallet_1.address),
          types.uint(5), // lobby id
        ],
        wallet_1.address
      ),
    ]);
    // console.log('block ', block.receipts[0].events);
    block.receipts[0].result.expectErr().expectUint(ERR_NOT_AUTHORIZED);
    // assertEquals(block2.receipts[0].events[0]["stx_transfer_event"]["amount"], "5");
  },
});

Clarinet.test({
  name: 'Ensure that owner can set a new owner',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;

    let block1 = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, SET_OWNER_FNC, [types.principal(wallet_1.address)], deployer.address),
    ]);
    block1.receipts[0].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: 'Ensure that non-owner users can not set a new owner',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;

    let block1 = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, SET_OWNER_FNC, [types.principal(wallet_1.address)], wallet_1.address),
    ]);
    block1.receipts[0].result.expectErr().expectUint(ERR_NOT_AUTHORIZED);
  },
});

// Clarinet.test({
//     name: "Ensure that owner can transfer ft from contract",
//     async fn(chain: Chain, accounts: Map<string, Account>) {
//         const deployer = accounts.get("deployer")!;
//         const wallet_1 = accounts.get("wallet_1")!;
//         const wallet_2 = accounts.get("wallet_2")!;

//         let block1 = chain.mineBlock([
//             Tx.contractCall(
//                 "ft",
//                 "transfer",
//                 // (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34)
//                 [
//                     types.uint(5),
//                     types.principal(deployer.address),
//                     types.principal(deployer.address+CONTRACT_EXT),
//                     types.none(),
//                 ],
//                 deployer.address,
//             ),
//             Tx.contractCall(
//                 CONTRACT_NAME,
//                 TRANSFER_FT_FNC,
//                 [
//                     types.principal(wallet_1.address),
//                     types.uint(5),
//                     types.principal(deployer.address+".ft"),
//                 ],
//                 deployer.address
//             )
//         ]);
//         // console.log('block1 ', block1, block1.receipts[0].events);
//         block1.receipts[0].result.expectOk().expectBool(true);
//         block1.receipts[1].result.expectOk().expectBool(true);
//     },
// });

// Clarinet.test({
//     name: "Ensure that non-owner can not transfer ft from contract",
//     async fn(chain: Chain, accounts: Map<string, Account>) {
//         const deployer = accounts.get("deployer")!;
//         const wallet_1 = accounts.get("wallet_1")!;
//         const wallet_2 = accounts.get("wallet_2")!;

//         let block1 = chain.mineBlock([
//             Tx.contractCall(
//                 "ft",
//                 "transfer",
//                 // (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34)
//                 [
//                     types.uint(5),
//                     types.principal(deployer.address),
//                     types.principal(deployer.address+CONTRACT_EXT),
//                     types.none(),
//                 ],
//                 deployer.address,
//             ),
//             Tx.contractCall(
//                 CONTRACT_NAME,
//                 TRANSFER_FT_FNC,
//                 [
//                     types.principal(wallet_1.address),
//                     types.uint(5),
//                     types.principal(deployer.address+".ft"),
//                 ],
//                 wallet_1.address
//             )
//         ]);
//         // console.log('block1 ', block1, block1.receipts[0].events);
//         block1.receipts[0].result.expectOk().expectBool(true);
//         block1.receipts[1].result.expectErr().expectUint(ERR_NOT_AUTHORIZED);
//     },
// });

// Clarinet.test({
//     name: "Ensure that owner can transfer nft from contract",
//     async fn(chain: Chain, accounts: Map<string, Account>) {
//         const deployer = accounts.get("deployer")!;
//         const wallet_1 = accounts.get("wallet_1")!;
//         const wallet_2 = accounts.get("wallet_2")!;

//         let block1 = chain.mineBlock([
//             Tx.contractCall(
//                 "nft",
//                 "transfer",
//                 // (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34)
//                 [
//                     types.uint(1),
//                     types.principal(deployer.address),
//                     types.principal(deployer.address+CONTRACT_EXT),
//                 ],
//                 deployer.address,
//             ),
//             Tx.contractCall(
//                 CONTRACT_NAME,
//                 TRANSFER_NFT_FNC,
//                 [
//                     types.principal(wallet_1.address),
//                     types.uint(1),
//                     types.principal(deployer.address+".nft"),
//                 ],
//                 deployer.address
//             )
//         ]);
//         // console.log('block1 ', block1, block1.receipts[0].events);
//         block1.receipts[0].result.expectOk().expectBool(true);
//         block1.receipts[1].result.expectOk().expectBool(true);
//     },
// });

// Clarinet.test({
//     name: "Ensure that non-owner can not transfer nft from contract",
//     async fn(chain: Chain, accounts: Map<string, Account>) {
//         const deployer = accounts.get("deployer")!;
//         const wallet_1 = accounts.get("wallet_1")!;
//         const wallet_2 = accounts.get("wallet_2")!;

//         let block1 = chain.mineBlock([
//             Tx.contractCall(
//                 "nft",
//                 "transfer",
//                 // (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34)
//                 [
//                     types.uint(1),
//                     types.principal(deployer.address),
//                     types.principal(deployer.address+CONTRACT_EXT),
//                 ],
//                 deployer.address,
//             ),
//             Tx.contractCall(
//                 CONTRACT_NAME,
//                 TRANSFER_NFT_FNC,
//                 [
//                     types.principal(wallet_1.address),
//                     types.uint(1),
//                     types.principal(deployer.address+".nft"),
//                 ],
//                 wallet_1.address
//             )
//         ]);
//         // console.log('block1 ', block1, block1.receipts[0].events);
//         block1.receipts[0].result.expectOk().expectBool(true);
//         block1.receipts[1].result.expectErr().expectUint(ERR_NOT_AUTHORIZED);
//     },
// });

// create 2 lobbies l1-w1 l2-w2. l1 - w1, w2 w3 w4 w5, l2 - w1, w2, w3
Clarinet.test({
  name: 'Ensure that flow is right: create 2 lobbies l1-w1 l2-w2. l1 - w1, w2 w3 w4 w5, l2 - w2, w3, w4. publish results, finish results, check balances and disable lobbies.',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet_1 = accounts.get('wallet_1')!;
    const wallet_2 = accounts.get('wallet_2')!;
    const wallet_3 = accounts.get('wallet_3')!;
    const wallet_4 = accounts.get('wallet_4')!;
    const wallet_5 = accounts.get('wallet_5')!;
    const walletAddressArray = [
      wallet_1.address,
      wallet_2.address,
      wallet_3.address,
      wallet_4.address,
      wallet_5.address,
    ];

    // create l1 - w1
    let block1 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), //hours
        ],
        wallet_1.address
      ),
    ]);
    block1.receipts[0].result.expectOk().expectUint(1);

    // create l2 - w2, l1 join w2, w3, w4, w5
    let block2 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_2.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        CREATE_FNC,
        [
          types.ascii(`lobby l2 description`),
          types.uint(5), // price
          types.uint(5), // factor
          types.uint(5), // commission
          types.ascii(lobbyMap), // map
          types.ascii(lobbyLength), //length
          types.ascii(lobbyTraffic), //traffic
          types.ascii(lobbyCurves), //curves
          types.uint(lobbyHours), //hours
        ],
        wallet_2.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_3.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_4.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(1), // lobby id
        ],
        wallet_5.address
      ),
    ]);
    // console.log(`block2 `, block2.receipts[0].events);
    block2.receipts[0].result.expectOk().expectUint(OK_SUCCES);
    block2.receipts[1].result.expectOk().expectUint(2);
    block2.receipts[2].result.expectOk().expectUint(OK_SUCCES);
    block2.receipts[3].result.expectOk().expectUint(OK_SUCCES);
    block2.receipts[4].result.expectOk().expectUint(OK_SUCCES);
    assertEquals(block2.receipts[0].events[0]['stx_transfer_event']['amount'], '5');
    assertEquals(block2.receipts[2].events[0]['stx_transfer_event']['amount'], '5');
    assertEquals(block2.receipts[3].events[0]['stx_transfer_event']['amount'], '5');
    assertEquals(block2.receipts[4].events[0]['stx_transfer_event']['amount'], '5');

    // create l2 join w1, w3
    let block3 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(2), // lobby id
        ],
        wallet_1.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        JOIN_FNC,
        [
          types.uint(2), // lobby id
        ],
        wallet_3.address
      ),
    ]);
    // console.log(`block3 `, block3.receipts[0].events);
    block3.receipts[0].result.expectOk().expectUint(OK_SUCCES);
    block3.receipts[1].result.expectOk().expectUint(OK_SUCCES);
    assertEquals(block3.receipts[0].events[0]['stx_transfer_event']['amount'], '5');
    assertEquals(block3.receipts[1].events[0]['stx_transfer_event']['amount'], '5');

    // publish scores

    // // (run-result (list 50 { lobby-id: uint, address: principal, score: uint, rank: uint, rank-factor: uint, rewards: uint, rac: uint})))
    // const publishManyRecords: any[] = [];
    // let testarray = [...Array(3).keys()].map((x) => x + 1);
    // testarray.forEach((id) => {
    //   let record = {
    //     'lobby-id': 1,
    //     // 'run-id': id,
    //     address: walletAddressArray[id - 1],
    //     score: 10,
    //     rank: id,
    //     'rank-factor': 15,
    //     rewards: 5,
    //     rac: 4,
    //     nft: 'nft:1',
    //   };
    //   publishManyRecords.push(record);
    // });
    // // console.log('publishManyRecords ', publishManyRecords);
    // const args = types.list(
    //   publishManyRecords.map((record) => {
    //     return types.tuple({
    //       'lobby-id': types.uint(record['lobby-id']),
    //       // 'run-id': types.uint(record['run-id']),
    //       address: types.principal(record.address),
    //       score: types.uint(record['score']),
    //       rank: types.uint(record['rank']),
    //       'rank-factor': types.uint(record['rank-factor']),
    //       rewards: types.uint(record['rewards']),
    //       rac: types.uint(record['rac']),
    //       nft: types.ascii(record['nft']),
    //     });
    //   })
    // );
    // console.log('args ', args);
    // let block = chain.mineBlock([Tx.contractCall(CONTRACT_NAME, PUBLISH_MANY_FNC, [args], deployer.address)]);
    // // console.log('block ', block.receipts[0].events);
    // block.receipts[0].result.expectOk().expectBool(true);
    // assertEquals(block.receipts[0].events[0].stx_transfer_event.amount, '4'); // 4 = rac value provided by owner

    // another way to publish results
    // publish for the w1, w2, w3,- l1
    // publish for the w1, w2, w3 - l2
    let block4 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        PUBLISH_MANY_FNC,
        [
          types.list([
            types.tuple({
              // l1 - w1
              'lobby-id': types.uint(1),
              address: types.principal(wallet_1.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('MiamiDegen#1'),
            }),
            types.tuple({
              // l1 - w2
              'lobby-id': types.uint(1),
              address: types.principal(wallet_2.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('MiamiDegen#2'),
            }),
            types.tuple({
              // l1 - w3
              'lobby-id': types.uint(1),
              address: types.principal(wallet_3.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('MiamiDegen#3'),
            }),
            types.tuple({
              // l2 - w1
              'lobby-id': types.uint(2),
              address: types.principal(wallet_1.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('NYCDegen#1'),
            }),
            types.tuple({
              // l2 - w2
              'lobby-id': types.uint(2),
              address: types.principal(wallet_2.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('NYCDegen#2'),
            }),
            types.tuple({
              // l2 - w3
              'lobby-id': types.uint(2),
              address: types.principal(wallet_3.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('NYCDegen#3'),
            }),
          ]),
        ],
        deployer.address
      ),
    ]);
    // check if published right
    // call read only get-score
    const tx_l1_w1 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(wallet_1.address),
      ],
      wallet_1.address
    );
    const tx_l1_w2 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(wallet_2.address),
      ],
      wallet_1.address
    );
    const tx_l1_w3 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(wallet_3.address),
      ],
      wallet_1.address
    );
    const tx_l2_w1 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(2), // lobby-id
        types.principal(wallet_1.address),
      ],
      wallet_1.address
    );
    const tx_l2_w2 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(2), // lobby-id
        types.principal(wallet_2.address),
      ],
      wallet_1.address
    );
    const tx_l2_w3 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(2), // lobby-id
        types.principal(wallet_3.address),
      ],
      wallet_1.address
    );
    // console.log(`tx `, tx);
    assertEquals(
      tx_l1_w1.result,
      '(ok {nft: "MiamiDegen#1", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_l1_w2.result,
      '(ok {nft: "MiamiDegen#2", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_l1_w3.result,
      '(ok {nft: "MiamiDegen#3", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_l2_w1.result,
      '(ok {nft: "NYCDegen#1", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_l2_w2.result,
      '(ok {nft: "NYCDegen#2", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_l2_w3.result,
      '(ok {nft: "NYCDegen#3", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );

    // publish for the  w4, w5 - l1
    // overwrite for the w1 - l1
    let block5 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        PUBLISH_MANY_FNC,
        [
          types.list([
            types.tuple({
              // l1 - w4
              'lobby-id': types.uint(1),
              address: types.principal(wallet_4.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('MiamiDegen#4'),
            }),
            types.tuple({
              // l1 - w5
              'lobby-id': types.uint(1),
              address: types.principal(wallet_5.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('MiamiDegen#5'),
            }),
            types.tuple({
              // l1 - w1
              'lobby-id': types.uint(1),
              address: types.principal(wallet_1.address),
              score: types.uint(69),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('MiamiDegen#1'),
            }),
          ]),
        ],
        deployer.address
      ),
    ]);
    // check if published right
    // also check overwriten l1 - w1
    const tx_l1_w1_2 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(wallet_1.address),
      ],
      wallet_1.address
    );
    const tx_l1_w4 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(wallet_4.address),
      ],
      wallet_1.address
    );
    const tx_l1_w5 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(wallet_5.address),
      ],
      wallet_1.address
    );

    assertEquals(
      tx_l1_w1_2.result,
      '(ok {nft: "MiamiDegen#1", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u69, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_l1_w4.result,
      '(ok {nft: "MiamiDegen#4", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_l1_w5.result,
      '(ok {nft: "MiamiDegen#5", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );

    // finish all
    // finish l1 - w1, w2, w3, w4, w5
    // finish l2 - w1, w2, w3
    let block6 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        FINISH_MANY_FNC,
        [
          types.list([
            types.tuple({
              // l1 - w1
              'lobby-id': types.uint(1),
              address: types.principal(wallet_1.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('MiamiDegen#1'),
            }),
            types.tuple({
              // l1 - w2
              'lobby-id': types.uint(1),
              address: types.principal(wallet_2.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('MiamiDegen#2'),
            }),
            types.tuple({
              // l1 - w3
              'lobby-id': types.uint(1),
              address: types.principal(wallet_3.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('MiamiDegen#3'),
            }),
            types.tuple({
              // l1 - w4
              'lobby-id': types.uint(1),
              address: types.principal(wallet_4.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('MiamiDegen#4'),
            }),
            types.tuple({
              // l1 - w5
              'lobby-id': types.uint(1),
              address: types.principal(wallet_5.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('MiamiDegen#5'),
            }),
          ]),
        ],
        deployer.address
      ),
      Tx.contractCall(
        CONTRACT_NAME,
        FINISH_MANY_FNC,
        [
          types.list([
            types.tuple({
              // l2 - w1
              'lobby-id': types.uint(2),
              address: types.principal(wallet_1.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('NYCDegen#1'),
            }),
            types.tuple({
              // l2 - w2
              'lobby-id': types.uint(2),
              address: types.principal(wallet_2.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('NYCDegen#2'),
            }),
            types.tuple({
              // l2 - w3
              'lobby-id': types.uint(2),
              address: types.principal(wallet_3.address),
              score: types.uint(10),
              rank: types.uint(1),
              'sum-rank-factor': types.uint(0),
              'rank-factor': types.uint(3),
              rewards: types.uint(5),
              rac: types.uint(4),
              nft: types.ascii('NYCDegen#3'),
            }),
          ]),
        ],
        deployer.address
      ),
    ]);

    const tx_fin_l1_w1 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(wallet_1.address),
      ],
      wallet_1.address
    );
    const tx_fin_l1_w2 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(wallet_2.address),
      ],
      wallet_1.address
    );
    const tx_fin_l1_w3 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(wallet_3.address),
      ],
      wallet_1.address
    );
    const tx_fin_l1_w4 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(wallet_4.address),
      ],
      wallet_1.address
    );
    const tx_fin_l1_w5 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(1), // lobby-id
        types.principal(wallet_5.address),
      ],
      wallet_1.address
    );

    const tx_fin_l2_w1 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(2), // lobby-id
        types.principal(wallet_1.address),
      ],
      wallet_1.address
    );
    const tx_fin_l2_w2 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(2), // lobby-id
        types.principal(wallet_2.address),
      ],
      wallet_1.address
    );
    const tx_fin_l2_w3 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_SCORE_FNC,
      [
        types.uint(2), // lobby-id
        types.principal(wallet_3.address),
      ],
      wallet_1.address
    );
    assertEquals(
      tx_fin_l1_w1.result,
      '(ok {nft: "MiamiDegen#1", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_fin_l1_w2.result,
      '(ok {nft: "MiamiDegen#2", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_fin_l1_w3.result,
      '(ok {nft: "MiamiDegen#3", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_fin_l1_w4.result,
      '(ok {nft: "MiamiDegen#4", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_fin_l1_w5.result,
      '(ok {nft: "MiamiDegen#5", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );

    assertEquals(
      tx_fin_l2_w1.result,
      '(ok {nft: "NYCDegen#1", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_fin_l2_w2.result,
      '(ok {nft: "NYCDegen#2", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(
      tx_fin_l2_w3.result,
      '(ok {nft: "NYCDegen#3", rac: u4, rank: u1, rank-factor: u3, rewards: u5, score: u10, sum-rank-factor: u0})'
    );
    assertEquals(block6.receipts[0].events[0].stx_transfer_event.amount, '4');
    assertEquals(block6.receipts[0].events[2].stx_transfer_event.amount, '4');
    assertEquals(block6.receipts[0].events[4].stx_transfer_event.amount, '4');
    assertEquals(block6.receipts[0].events[6].stx_transfer_event.amount, '4');
    assertEquals(block6.receipts[0].events[8].stx_transfer_event.amount, '4');
    assertEquals(block6.receipts[1].events[0].stx_transfer_event.amount, '4');
    assertEquals(block6.receipts[1].events[2].stx_transfer_event.amount, '4');
    assertEquals(block6.receipts[1].events[4].stx_transfer_event.amount, '4');

    // check l1, l2 active = true
    const tx_active_l1 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_LOBBY_FNC,
      [
        types.uint(1), // lobby-id
      ],
      wallet_1.address
    );
    const tx_active_l2 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_LOBBY_FNC,
      [
        types.uint(2), // lobby-id
      ],
      wallet_1.address
    );
    assertEquals(
      tx_active_l1.result,
      `(ok {active: true, balance: u25, commission: u5, curves: "${lobbyCurves}", description: "lobby description", factor: u5, hours: u${lobbyHours}, length: "${lobbyLength}", mapy: "${lobbyMap}", owner: ${wallet_1.address}, price: u5, traffic: "${lobbyTraffic}"})`
    );
    assertEquals(
      tx_active_l2.result,
      `(ok {active: true, balance: u15, commission: u5, curves: "${lobbyCurves}", description: "lobby l2 description", factor: u5, hours: u${lobbyHours}, length: "${lobbyLength}", mapy: "${lobbyMap}", owner: ${wallet_2.address}, price: u5, traffic: "${lobbyTraffic}"})`
    );

    //disable l1, l2
    let block7 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        DISABLE_FNC,
        [
          types.uint(1), // lobby id
        ],
        deployer.address
      ),
    ]);
    block7.receipts[0].result.expectOk().expectBool(true);
    // check l1 active = false
    const tx_nonactive_l1 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_LOBBY_FNC,
      [
        types.uint(1), // lobby-id
      ],
      wallet_1.address
    );
    // check l2 active = true
    const tx_active_l2_2 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_LOBBY_FNC,
      [
        types.uint(2), // lobby-id
      ],
      wallet_1.address
    );
    assertEquals(
      tx_nonactive_l1.result,
      `(ok {active: false, balance: u25, commission: u5, curves: "${lobbyCurves}", description: "lobby description", factor: u5, hours: u${lobbyHours}, length: "${lobbyLength}", mapy: "${lobbyMap}", owner: ${wallet_1.address}, price: u5, traffic: "${lobbyTraffic}"})`
    );
    assertEquals(
      tx_active_l2_2.result,
      `(ok {active: true, balance: u15, commission: u5, curves: "${lobbyCurves}", description: "lobby l2 description", factor: u5, hours: u${lobbyHours}, length: "${lobbyLength}", mapy: "${lobbyMap}", owner: ${wallet_2.address}, price: u5, traffic: "${lobbyTraffic}"})`
    );
    let block8 = chain.mineBlock([
      Tx.contractCall(
        CONTRACT_NAME,
        DISABLE_FNC,
        [
          types.uint(2), // lobby id
        ],
        deployer.address
      ),
    ]);
    // console.log(`block2 `, block2);
    block8.receipts[0].result.expectOk().expectBool(true);

    // check l2 active = false
    const tx_nonactive_l2 = chain.callReadOnlyFn(
      CONTRACT_NAME,
      GET_LOBBY_FNC,
      [
        types.uint(2), // lobby-id
      ],
      wallet_1.address
    );
    assertEquals(
      tx_nonactive_l2.result,
      `(ok {active: false, balance: u15, commission: u5, curves: "${lobbyCurves}", description: "lobby l2 description", factor: u5, hours: u${lobbyHours}, length: "${lobbyLength}", mapy: "${lobbyMap}", owner: ${wallet_2.address}, price: u5, traffic: "${lobbyTraffic}"})`
    );
  },
});