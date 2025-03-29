import { Address, Cell, beginCell, toNano, Contract } from '@ton/core';
import { TonClient } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface StateInit {
    code: Cell;
    data: Cell;
}

export class MazeRouter implements Contract {
    private constructor(
        readonly address: Address,
        readonly init?: StateInit
    ) {}

    static createForDeploy(code: Cell, data: Cell): MazeRouter {
        const stateInit: StateInit = {
            code,
            data
        };
        const address = contractAddress(stateInit);
        return new MazeRouter(address, stateInit);
    }

    async sendDeploy(client: TonClient, value: bigint) {
        if (!this.init) {
            throw new Error('Contract is already deployed');
        }

        // Создаем сообщение согласно TL-B схеме
        const message = beginCell()
            // CommonMsgInfoRelaxed$0 (int_msg_info)
            .storeUint(0x18, 6) // prefix + ihr_disabled:Bool + bounce:Bool + bounced:Bool
            .storeAddress(this.address)
            .storeCoins(value)
            .storeUint(0, 1 + 4 + 4 + 64 + 32) // ihr_fee:Grams + fwd_fee:Grams + created_lt:uint64 + created_at:uint32
            // init:(Maybe (Either StateInit ^StateInit))
            .storeUint(1, 1) // init field present
            .storeUint(0, 1) // init serialized in this cell
            .storeRef(beginCell()
                .storeRef(this.init.code)
                .storeRef(this.init.data)
                .endCell())
            // body:(Either X ^X)
            .storeUint(0, 1) // body serialized in this cell
            .storeUint(0, 32) // empty body
            .endCell();

        await client.sendExternalMessage(this, message);
    }
}

function contractAddress(init: StateInit): Address {
    const stateInitCell = beginCell()
        .storeRef(init.code)
        .storeRef(init.data)
        .endCell();

    const hash = stateInitCell.hash();
    return new Address(0, hash);
}

export async function deploy() {
    const mnemonic = process.env.MNEMONIC;
    if (!mnemonic) throw new Error('MNEMONIC not set');

    const key = await mnemonicToPrivateKey(mnemonic.split(' '));
    const client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.API_KEY
    });

    const contractPath = path.join(__dirname, '../build/MazeRouter.cell');
    if (!fs.existsSync(contractPath)) {
        throw new Error('Contract not found. Please compile it first');
    }

    const code = Cell.fromBoc(fs.readFileSync(contractPath))[0];
    
    // Создаем данные контракта с адресом владельца
    const ownerAddress = Address.parse(process.env.OWNER_ADDRESS || '');
    const data = beginCell()
        .storeAddress(ownerAddress)
        .storeUint(20, 16) // commission_percent = 0.2%
        .endCell();

    const contract = MazeRouter.createForDeploy(code, data);
    
    // Увеличиваем задержку перед запросом баланса
    await new Promise(resolve => setTimeout(resolve, 5000));
    const balance = await client.getBalance(contract.address);

    console.log('Contract address:', contract.address.toString());
    console.log('Contract balance:', balance.toString());

    if (balance < toNano('0.1')) {
        throw new Error('Insufficient balance');
    }

    // Увеличиваем задержку перед деплоем
    await new Promise(resolve => setTimeout(resolve, 5000));
    await contract.sendDeploy(client, toNano('0.1'));
}

deploy().catch(console.error); 