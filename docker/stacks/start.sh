mkdir -p ./{persistent-data/postgres,persistent-data/stacks-blockchain,bns}
export POSTGRES_PASSWORD=postgres
docker network create stacks-blockchain
sleep 2
docker run -d --rm \
    --name postgres \
    --net=stacks-blockchain \
    -e POSTGRES_PASSWORD=postgres \
    -v $(pwd)/persistent-data/postgres:/var/lib/postgresql/data \
    -p 5432:5432 \
    postgres:alpine
sleep 5
docker run -d --rm \
    --name stacks-blockchain-api \
    --net=stacks-blockchain \
    --env-file $(pwd)/.env \
    -v $(pwd)/bns:/bns-data \
    -p 3700:3700 \
    -p 3999:3999 \
    blockstack/stacks-blockchain-api:2.1.1
sleep 5
docker run -d --rm \
    --name stacks-blockchain \
    --net=stacks-blockchain \
    -v $(pwd)/persistent-data/stacks-blockchain:/root/stacks-node/data \
    -v $(pwd)/config:/src/stacks-node \
    -p 20443:20443 \
    -p 20444:20444 \
    blockstack/stacks-blockchain \
/bin/stacks-node start --config /src/stacks-node/Config.toml
