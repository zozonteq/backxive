import { ListModule } from './modules/list';
import { TweetModule } from './modules/tweet';
import { ImageModule } from './modules/image';

const SUB_COMMANDS = ['list', 'download', 'image'] as const;
type SubCommand = typeof SUB_COMMANDS[number];

function printUsage() {
  console.log(`
Usage: bun run start <SUB_COMMAND> <OPTIONS>

Subcommands:
  list <username>    Generate tweet list for a user
  download <list_file> <username> Download tweets from a list file for a user
  image <username>  Download images for a user
  `);
}

async function main() {
  const args = process.argv.slice(2);
  const subCommand = args[0] as SubCommand;

  if (!subCommand || !SUB_COMMANDS.includes(subCommand)) {
    printUsage();
    process.exit(1);
  }

  try {
    switch (subCommand) {
      case 'list': {
        const username = args[1];
        if (!username) {
          console.error('Error: Username is required for list command');
          process.exit(1);
        }
        const listModule = new ListModule(username);
        await listModule.generateList();
        break;
      }
      case 'download': {
        const listFile = args[1];
        const username = args[2]; // New username argument
        if (!listFile) {
          console.error('Error: List file is required for download command');
          printUsage(); // Call printUsage for context
          process.exit(1);
        }
        if (!username) { // Validate username
          console.error('Error: Username is required for download command');
          printUsage(); // Call printUsage for context
          process.exit(1);
        }
        // Instantiate TweetModule without listFile in constructor
        const tweetModule = new TweetModule(); 
        // Pass listFile and username to processAllTweets
        const result = await tweetModule.processAllTweets(listFile, username); 
        console.log(result); // Log the summary message
        break;
      }
      case 'image': {
        const username = args[1];
        if (!username) {
          console.error('Error: Username is required for image command');
          process.exit(1);
        }
        const listFile = `list_${username}.json`;
        const imageModule = new ImageModule(listFile);
        await imageModule.processAllImages(username);
        break;
      }
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main(); 