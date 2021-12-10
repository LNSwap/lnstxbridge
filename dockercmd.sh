# helper script to pass commands to docker containers
container="regtest"
bar="$1"
echo ${bar}

cmd='bash -c "bitcoin-cli send {\"'${bar}'\":1}"'
final_cmd="docker exec -it $container $cmd"

echo "running command: \"$final_cmd\""
eval $final_cmd