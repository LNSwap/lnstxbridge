# LN - STX Bridge
## Submarine Swaps between STX on Stacks <-> Bitcoin on Lightning Network

* This app enables functionality as described in https://github.com/stacksgov/Stacks-Grants/issues/172

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
* copy boltz.conf to ~/.boltz/boltz.conf and modify as needed  
* start the app  
`npm run start`

## use 
* API is available at http://localhost:9002, e.g. curl http://localhost:9002/getpairs  
refer to [API docs](https://docs.boltz.exchange/en/latest/api/)
* Deploy frontend (available at https://github.com/pseudozach/lnstxbridge-frontend)