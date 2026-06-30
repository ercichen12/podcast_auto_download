import { loginXiaoyuzhouWithSms, sendXiaoyuzhouSmsCode } from './xiaoyuzhou-search.js';

function parseArgs(argv) {
  if (argv[0] === '--help' || argv[0] === '-h') {
    return { command: '', help: true, areaCode: '+86', tokenPath: 'config/xiaoyuzhou-token.json' };
  }

  const args = {
    command: argv[0] || '',
    areaCode: '+86',
    tokenPath: 'config/xiaoyuzhou-token.json',
  };

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--phone') {
      args.phone = argv[i + 1];
      i += 1;
    } else if (arg === '--code') {
      args.code = argv[i + 1];
      i += 1;
    } else if (arg === '--area-code') {
      args.areaCode = argv[i + 1];
      i += 1;
    } else if (arg === '--token-path') {
      args.tokenPath = argv[i + 1];
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node src/xiaoyuzhou-auth.js send-code --phone <phone> [--area-code +86]
  node src/xiaoyuzhou-auth.js login --phone <phone> --code <sms-code> [--area-code +86] [--token-path config/xiaoyuzhou-token.json]

Examples:
  npm run xiaoyuzhou:send-code -- --phone 13800138000
  npm run xiaoyuzhou:login -- --phone 13800138000 --code 123456
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.command) {
    printHelp();
    return;
  }

  if (args.command === 'send-code') {
    const result = await sendXiaoyuzhouSmsCode({
      phone: args.phone,
      areaCode: args.areaCode,
      log: async (message) => console.log(message),
    });
    console.log(`SMS code requested for ${result.areaCode} ${result.phone}.`);
    return;
  }

  if (args.command === 'login') {
    const result = await loginXiaoyuzhouWithSms({
      phone: args.phone,
      code: args.code,
      areaCode: args.areaCode,
      tokenPath: args.tokenPath,
      log: async (message) => console.log(message),
    });
    const account = result.nickname || result.uid || 'unknown account';
    console.log(`Xiaoyuzhou token saved to ${result.tokenPath}.`);
    console.log(`Logged in as ${account}.`);
    return;
  }

  throw new Error(`Unknown command: ${args.command}`);
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
