# Introduction
Instructions for running lnstxbridge through docker-compose. 
The docker-compose consist of the following services:
- lnstxbridge backend API (running on port 9002)
- lnstxbridge frontend (running on port 3000)

You can build your own images, or use images built by us (default latest version in docker-compose)

# Docker build
```
git clone https://github.com/pseudozach/lnstxbridge
cd lnstxbridge
docker buildx build --platform linux/amd64 -t your_tag_name .


git clone https://github.com/pseudozach/lnstxbridge-frontend
cd lnstxbridge-frontend
docker buildx build --platform linux/amd64 -t your_tag_name .
```
# Configuration

Each services needs it own configuration file to be mounted inside docker container at startup. 
You should edit configuration files with your own values.

## lnstxbridge backend API 
Open and edit the `boltz.conf` with your values
### LND
- lnd endpoint
- macaroonpath 
- certpath
### BTC
- bitcoin node endpoint
- cookie
- rpcuser
- rpcpass
### Stacks
- stacks node endpoint, if you cannot host your own node, you can get in touch with us for API access.
#### Onchain data
We need to provide information about smart contracts that service will be interacting with
##### Swap contracts
These contracts should be deployed for every deployment of this service and should not be shared with other deployments
- stxswap contract address - latest version under /contracts folder
- sip10swap contract address - latest version under /contracts folder
##### USDA token contract address
Currently alongside STX and Lightning we support swapping of USDA tokens. We need to provide deployment of the USDA token of the chain we are deploying to:
- contractAddress

# lnstxbridge frontend
Open and edit `frontend/.env` with your values
Contracts you deployed in step above for the backend will also be needed in here