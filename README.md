# LN - STX Bridge with Provider Swap Network
## Submarine/Atomic Swaps between assets on Stacks <-> Bitcoin (onchain and Lightning Network)

* This version adds independent provider support such that any entity can register to serve swaps. This app will act as an aggregator to route swap requests to registered swap providers.

* This app enables functionality as described in https://github.com/stacksgov/Stacks-Grants/issues/172 and https://github.com/stacksgov/Stacks-Grants/issues/204
* Running on https://lnswap.org

## install
* clone the repo, install requirements and compile  
`git clone https://github.com/pseudozach/lnstxbridge.git`  
`cd lnstxbridge && npm i && npm run compile`  
* start btc & lnd  
`npm run docker:regtest`
* start stacks  
`npm run stacks:mocknet`
* fund a regtest account and deploy latest Clarity contract under contracts/  
`npm run stacks:fund && npm run stacks:deploy`
* copy boltz.conf to ~/.lnstx/boltz.conf and modify as needed  
* start the app  
`npm run start`

* clone [lnstxbridge-client](https://github.com/pseudozach/lnstxbridge-client.git) repo and start it with `aggregatorUrl` parameter set to this bridge IP:port.

## use 
* API is available at http://localhost:9007, e.g. `curl http://localhost:9007/getpairs`  
refer to [API docs](https://docs.boltz.exchange/en/latest/api/)