// Мінімальний, модульно-локальний тип для `node:process`, використовуваний лише
// scripts/seed-images.ts. Не імпортуємо цей файл — його підключає ///-посилання
// в seed-images.ts, і саме тому він живе окремо: цей файл — не ES-модуль (немає
// import/export верхнього рівня), тож `declare module` тут — це нове оголошення
// амбієнтного модуля, а не augmentation існуючого (яку TS вимагав би, якби цей
// блок лежав у файлі з власними import/export — див. коментар у seed-images.ts).
//
// Навмисно НЕ використовуємо @types/node/process.d.ts: той файл сам усередині
// оголошує `global { var process: NodeJS.Process }`, тобто зробив би `process`
// видимим як глобальну змінну в усій програмі, включно з src/** (Cloudflare
// Workers), де Node-глобалів бути не повинно. Тут — лише те, що реально
// використовує seed-images.ts.
declare module 'node:process' {
  interface Process {
    readonly argv: string[]
    readonly env: Readonly<Record<string, string | undefined>>
    exitCode: number | undefined
  }
  const process: Process
  export default process
}
