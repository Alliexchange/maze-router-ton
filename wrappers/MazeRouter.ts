import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type MazeRouterConfig = {
    ownerAddress: Address;
    commissionPercent: number;
};

export function mazeRouterConfigToCell(config: MazeRouterConfig): Cell {
    return beginCell()
        .storeAddress(config.ownerAddress)
        .storeUint(config.commissionPercent, 16)
        .endCell();
}

export class MazeRouter implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new MazeRouter(address);
    }

    static createFromConfig(config: MazeRouterConfig, code: Cell, workchain = 0) {
        const data = mazeRouterConfigToCell(config);
        const init = { code, data };
        return new MazeRouter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransaction(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        targetAddress: Address,
        amount: bigint
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeAddress(targetAddress)
                .storeCoins(amount)
                .endCell(),
        });
    }

    async getRouterData(provider: ContractProvider) {
        const { stack } = await provider.get('get_router_data', []);
        return {
            ownerAddress: stack.readAddress(),
            commissionPercent: stack.readNumber(),
        };
    }
} 