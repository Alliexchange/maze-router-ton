import { Address, beginCell, toNano, Contract } from '@ton/core';
import { TonClient } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

// Функция для шифрования адреса
function encryptAddress(address: string, key: Buffer, iv: Buffer): Buffer {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
        cipher.update(address),
        cipher.final()
    ]);
    return encrypted;
}

async function send() {
    const mnemonic = process.env.MNEMONIC;
    if (!mnemonic) throw new Error('MNEMONIC not set');

    const key = await mnemonicToPrivateKey(mnemonic.split(' '));
    const client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.API_KEY
    });

    // Адрес контракта
    const contractAddress = Address.parse(process.env.CONTRACT_ADDRESS || '');
    
    // Создаем объект контракта
    const contract: Contract = {
        address: contractAddress
    };
    
    // Адрес получателя (который нужно зашифровать)
    const targetAddress = Address.parse(process.env.TARGET_ADDRESS || '');
    
    // Генерируем ключ и IV для шифрования
    const encryptionKey = crypto.randomBytes(32); // 256 бит
    const iv = crypto.randomBytes(16); // 128 бит
    
    // Шифруем адрес
    const encryptedAddress = encryptAddress(targetAddress.toString(), encryptionKey, iv);
    
    // Создаем сообщение с зашифрованным адресом
    const message = beginCell()
        .storeBuffer(encryptedAddress)
        .endCell();

    // Отправляем транзакцию
    await client.sendExternalMessage(contract, message);

    console.log('Transaction sent successfully!');
    console.log('Contract address:', contractAddress.toString());
    console.log('Target address:', targetAddress.toString());
    console.log('Encryption key:', encryptionKey.toString('hex'));
    console.log('IV:', iv.toString('hex'));
}

send().catch(console.error); 