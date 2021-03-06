import fs from 'fs';
import path from 'path';
import grpc from 'grpc';
import { Arguments } from 'yargs';
import { getServiceDataDir } from '../Utils';
import { BoltzClient } from '../proto/boltzrpc_grpc_pb';

export interface GrpcResponse {
  toObject: () => any;
}

export const loadBoltzClient = (argv: Arguments<any>): BoltzClient => {
  const certPath = argv.tlscertpath ? argv.tlscertpath : path.join(getServiceDataDir('lnstx'), 'tls.cert');
  const cert = fs.readFileSync(certPath);

  return new BoltzClient(`${argv.rpc.host}:${argv.rpc.port}`, grpc.credentials.createSsl(cert));
};

export const callback = (error: Error | null, response: GrpcResponse): void => {
  if (error) {
    printError(error);
  } else {
    const responseObj = response.toObject();
    if (Object.keys(responseObj).length === 0) {
      console.log('success');
    } else {
      printResponse(responseObj);
    }
  }
};

export const printResponse = (response: unknown): void => {
  console.log(JSON.stringify(response, undefined, 2));
};

export const printError = (error: Error): void => {
  console.error(`${error.name}: ${error.message}`);
};
