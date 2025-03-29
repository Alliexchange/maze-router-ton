import { compileFunc } from '@ton-community/func-js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    // Читаем исходный код контракта и стандартной библиотеки
    const contractSource = fs.readFileSync(
        path.resolve(__dirname, '../contracts/MazeRouter.fc'),
        'utf8'
    );
    
    const stdlibSource = fs.readFileSync(
        path.resolve(__dirname, '../contracts/stdlib.fc'),
        'utf8'
    );

    // Компилируем контракт
    const result = await compileFunc({
        sources: [
            {
                filename: 'stdlib.fc',
                content: stdlibSource
            },
            {
                filename: 'MazeRouter.fc',
                content: contractSource
            }
        ]
    });

    if (result.status === 'error') {
        console.error('Error compiling contract:', result.message);
        process.exit(1);
    }

    // Создаем директорию build, если её нет
    const buildDir = path.resolve(__dirname, '../build');
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir);
    }

    // Сохраняем скомпилированный контракт
    fs.writeFileSync(
        path.resolve(buildDir, 'MazeRouter.cell'),
        Buffer.from(result.codeBoc, 'base64')
    );

    console.log('Contract compiled successfully!');
}

main().catch(console.error); 