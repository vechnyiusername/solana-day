import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    sendAndConfirmTransaction,
    Transaction,
} from '@solana/web3.js';
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    transfer,
    getAccount,
} from '@solana/spl-token';
import * as bs58 from 'bs58';

// 1. Подключение к Solana (Devnet)
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
console.log('Подключено к Solana Devnet.');

async function main() {
    // 2. Создание Кошелька (Адрес и Секретный Ключ)
    // В реальном приложении секретный ключ никогда не хранят в коде!
    // Используют либо аппаратные кошельки, либо переменные окружения.
    const payer = Keypair.generate();
    console.log('Адрес кошелька плательщика:', payer.publicKey.toBase58());
    // console.log('Секретный ключ (НЕ ДЕЛИТЕСЬ ИМ!):', bs58.encode(payer.secretKey)); // Для демонстрации

    // 3. Получение Токенов (Airdrop) для оплаты комиссий
    console.log('Запрашиваю Airdrop для плательщика...');
    const airdropSignature = await connection.requestAirdrop(
        payer.publicKey,
        2 * LAMPORTS_PER_SOL // Запросим 2 SOL
    );
    await connection.confirmTransaction(airdropSignature);
    console.log('Airdrop получен.');
    let payerBalance = await connection.getBalance(payer.publicKey);
    console.log('Баланс плательщика:', payerBalance / LAMPORTS_PER_SOL, 'SOL');

    // 4. Создание Токена SPL (Mint)
    console.log('\nСоздаю новый SPL токен...');
    const mintAuthority = Keypair.generate(); // Кто может выпускать токены
    const freezeAuthority = Keypair.generate(); // Кто может замораживать токены

    const mint = await createMint(
        connection,
        payer, // Кошелек, который платит комиссию за транзакцию
        mintAuthority.publicKey, // Адрес, который может создавать новые токены
        freezeAuthority.publicKey, // Адрес, который может замораживать токены
        9 // Количество знаков после запятой (decimals)
    );
    console.log('Адрес нового SPL токена (Mint Account):', mint.toBase58());

    // 5. Создание/Получение Счета Токена (для Payer)
    // Это как банковский счет, но только для нашего нового токена.
    console.log('\nСоздаю/получаю счет токена для плательщика...');
    const payerTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer, // Кошелек, который платит комиссию
        mint, // Наш только что созданный токен
        payer.publicKey // Владелец этого токен-счета
    );
    console.log('Адрес счета токена плательщика:', payerTokenAccount.address.toBase58());

    // 6. Выпуск Токенов (Mint) на счет плательщика
    console.log('\nВыпускаю 1000 токенов на счет плательщика...');
    await mintTo(
        connection,
        payer, // Кошелек, который платит комиссию
        mint, // Наш токен
        payerTokenAccount.address, // Куда выпускаем токены
        mintAuthority, // Адрес, который имеет право выпускать токены
        1000 * Math.pow(10, 9) // Количество токенов (с учетом decimals)
    );
    console.log('Токены выпущены.');

    // Проверка баланса токенов плательщика
    let payerTokenBalance = await getAccount(connection, payerTokenAccount.address);
    console.log(
        'Баланс токенов плательщика:',
        Number(payerTokenBalance.amount) / Math.pow(10, 9),
        'токенов'
    );

    // 7. Создание второго кошелька и его счета токена для демонстрации перевода
    const receiver = Keypair.generate();
    console.log('\nАдрес кошелька получателя:', receiver.publicKey.toBase58());

    console.log('Создаю/получаю счет токена для получателя...');
    const receiverTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer, // Payer платит за создание счета для receiver
        mint,
        receiver.publicKey
    );
    console.log('Адрес счета токена получателя:', receiverTokenAccount.address.toBase58());

    // 8. Отправка Токенов от плательщика получателю
    console.log('\nПеревожу 100 токенов от плательщика получателю...');
    await transfer(
        connection,
        payer, // Кошелек, который платит комиссию
        payerTokenAccount.address, // Откуда переводим
        receiverTokenAccount.address, // Куда переводим
        payer.publicKey, // Владелец отправляющего счета (payer)
        100 * Math.pow(10, 9) // Количество токенов для перевода
    );
    console.log('Токены переведены.');

    // 9. Проверка Баланса Получателя
    let receiverTokenBalance = await getAccount(connection, receiverTokenAccount.address);
    console.log(
        'Баланс токенов получателя:',
        Number(receiverTokenBalance.amount) / Math.pow(10, 9),
        'токенов'
    );

    // Обновленный баланс токенов плательщика
    payerTokenBalance = await getAccount(connection, payerTokenAccount.address);
    console.log(
        'Новый баланс токенов плательщика:',
        Number(payerTokenBalance.amount) / Math.pow(10, 9),
        'токенов'
    );

    payerBalance = await connection.getBalance(payer.publicKey);
    console.log('Оставшийся баланс SOL плательщика (после комиссий):', payerBalance / LAMPORTS_PER_SOL, 'SOL');

}

main().catch(err => {
    console.error(err);
});