#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const p = require('@clack/prompts');

const VERSION = '1.2.0';

const SKILLS = [
  'DSA',
  'LangChain',
  'Llamaindex',
  'MongoDB',
  'PostgreSQL',
  'React',
  'docker-k8s-mlops',
  'fastapi_skill',
  'llm_agent_security',
  'mcp',
  'pydantic'
];

// ASCII Art Banner
const BANNER = `
\x1b[36m  _____                      _                                  
 |  __ \\                    | |                                 
 | |  | |  ___ __   __ ___  | |  ___   _ __   ___  _ __  ___    
 | |  | | / _ \\\\ \\ / // _ \\ | | / _ \\ | '_ \\ / _ \\| '__|/ __|   
 | |__| ||  __/ \\ V /|  __/ | || (_) || |_) ||  __/| |   \\__ \\   
 |_____/  \\___|  \\_/  \\___| |_| \\___/ | .__/  \\___||_|   |___/   
                                      | |                       
  _____  _    _ _  _                      |_|                    
 / ____|| |  (_) | |                                            
| (___  | | ___| | | ___   ___                                  
 \\___ \\ | |/ / | | |/ __| / __|                                 
 ____) ||   <  | | |\\__ \\ \\__ \\                                 
|_____/ |_|\\_\\_|_|_||___/ |___/                                 
                                                                \x1b[0m
\x1b[35m=== Developer Skills Bank CLI Installer v${VERSION} ===\x1b[0m
`;

// Helper: Recursive copy
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      // Exclude system files and node_modules if any exist
      if (childItemName === '.git' || childItemName === 'node_modules') return;
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Helper: Get Claude Desktop Config Path
function getClaudeConfigPath() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  } else if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else {
    return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }
}

// Helper: Configure Claude Desktop MCP
function configureClaudeMCP(skillsDirAbsolute) {
  const configPath = getClaudeConfigPath();
  const configDir = path.dirname(configPath);
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(content) || {};
    } catch (err) {
      console.warn(`\x1b[33mWarning: Failed to parse existing Claude config: ${err.message}\x1b[0m`);
      config = {};
    }
  }
  
  if (!config.mcpServers) {
    config.mcpServers = {};
  }
  
  config.mcpServers['developer-skills-bank'] = {
    command: 'npx',
    args: [
      '-y',
      '@modelcontextprotocol/server-filesystem',
      path.resolve(skillsDirAbsolute)
    ]
  };
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`\x1b[32m\n✓ Success! Configured MCP server 'developer-skills-bank' pointing to:\x1b[0m`);
  console.log(`  \x1b[36m${path.resolve(skillsDirAbsolute)}\x1b[0m`);
  console.log(`\x1b[32mClaude Desktop configuration updated at:\x1b[0m`);
  console.log(`  \x1b[36m${configPath}\x1b[0m`);
  console.log(`\x1b[33mPlease restart Claude Desktop to load the new skills MCP server.\x1b[0m`);
}

// Helper: Install specific skill
function installSkill(skillName, destDir) {
  if (!SKILLS.includes(skillName)) {
    console.error(`\x1b[31mError: Skill "${skillName}" is not available.\x1b[0m`);
    console.log(`Available skills: ${SKILLS.join(', ')}`);
    return false;
  }
  
  const packageRoot = path.join(__dirname, '..');
  const srcPath = path.join(packageRoot, skillName);
  const targetPath = path.join(destDir, skillName);
  
  if (!fs.existsSync(srcPath)) {
    // If running in development workspace and path resolves differently
    const devPath = path.join(process.cwd(), skillName);
    if (fs.existsSync(devPath)) {
      copyRecursiveSync(devPath, targetPath);
      console.log(`\x1b[32m✓ Installed skill "${skillName}" (exact structure) to ${targetPath}\x1b[0m`);
      return true;
    }
    console.error(`\x1b[31mError: Source folder not found for skill "${skillName}" at ${srcPath}\x1b[0m`);
    return false;
  }
  
  copyRecursiveSync(srcPath, targetPath);
  console.log(`\x1b[32m✓ Installed skill "${skillName}" (exact structure) to ${targetPath}\x1b[0m`);
  return true;
}

// Helper: Install all skills
function installAllSkills(destDir) {
  console.log(`\x1b[36mInstalling all skills to: ${path.resolve(destDir)}...\x1b[0m`);
  let successCount = 0;
  for (const skill of SKILLS) {
    if (installSkill(skill, destDir)) {
      successCount++;
    }
  }
  console.log(`\x1b[32m\n✓ Completed! Successfully installed ${successCount}/${SKILLS.length} skills maintaining full folder structures.\x1b[0m`);
}

// Helper: Print Help
function printHelp() {
  console.log(`
Usage:
  npx developer-skills-bank [options]

Options:
  -h, --help             Show this help message
  -v, --version          Show version number
  -a, --all              Install all skills non-interactively
  -s, --skill <name>     Install a single skill by name (e.g. -s pydantic)
  -d, --dest <dir>       Specify target installation directory (default: ./skills)
  -m, --mcp              Configure Claude Desktop MCP file server pointing to the installation dir

Examples:
  npx developer-skills-bank --all --dest ./my-skills
  npx developer-skills-bank --skill pydantic --dest ./my-skills
  npx developer-skills-bank --all --mcp
`);
}

// Helper: Print Integration Guidelines
function printGuidelines() {
  console.log(`
\x1b[1m\x1b[35m=== CLI & AGENT HARNESS INTEGRATION GUIDELINES ===\x1b[0m

\x1b[1m1. Cursor IDE (.cursorrules)\x1b[0m
Cursor expects rules in a single \x1b[36m.cursorrules\x1b[0m file at your project's root.
To use these skills in Cursor, you can append selected rules from any skill's \x1b[36mSKILL.md\x1b[0m or references directly into your \x1b[36m.cursorrules\x1b[0m file.
Alternatively, Cursor supports reading files inside a directory or context via the \x1b[32m@\x1b[0m symbol (e.g. \x1b[32m@folder\x1b[0m or \x1b[32m@file\x1b[0m). Type \x1b[32m@\x1b[0m and choose the skill folder/file to guide Cursor's composer!

\x1b[1m2. Claude Code\x1b[0m
Claude Code runs in your terminal and respects project context. You can:
- Mount the skills directory using the Claude Desktop MCP configuration (see Option 3 in main menu).
- Explicitly tell Claude Code to read specific skills:
  \x1b[33mclaude "Read the fastapi_skill/SKILL.md manual and design a database pipeline"\x1b[0m

\x1b[1m3. Gemini CLI / Copilot CLI\x1b[0m
Add the target skills folder as reference files in your prompt context, or instruct the CLI to read the manual:
  \x1b[33mgemini --context ./skills/pydantic/SKILL.md "create a schema"\x1b[0m

\x1b[1m4. Custom Agent Harnesses (LangChain / LlamaIndex / AutoGPT / CrewAI)\x1b[0m
If you are developing custom agent harnesses, you can load these directories as a knowledge base:
- In \x1b[32mLlamaIndex\x1b[0m, use \x1b[36mSimpleDirectoryReader(input_dir='./skills')\x1b[0m.
- In \x1b[32mLangChain\x1b[0m, use \x1b[36mDirectoryLoader('./skills')\x1b[0m.
`);
}

// Interactive Mode main loop
async function runInteractive() {
  p.intro(`\x1b[36m${BANNER}\x1b[0m`);
  
  while (true) {
    const choice = await p.select({
      message: 'Choose an action:',
      options: [
        { value: 'install_skills', label: '📂 Install Skills' },
        { value: 'configure_mcp', label: '🤖 Configure Claude Desktop MCP' },
        { value: 'guidelines', label: '🧭 View Integration Guidelines' },
        { value: 'exit', label: '❌ Exit' }
      ]
    });

    if (p.isCancel(choice) || choice === 'exit') {
      p.outro('Goodbye!');
      break;
    }

    if (choice === 'install_skills') {
      const mode = await p.select({
        message: 'How would you like to install the skills?',
        options: [
          { value: 'all', label: 'All skills (Default)' },
          { value: 'specific', label: 'Select specific skills from a checklist' }
        ]
      });

      if (p.isCancel(mode)) continue;

      let selectedSkills = [];
      if (mode === 'all') {
        selectedSkills = SKILLS;
      } else {
        selectedSkills = await p.multiselect({
          message: 'Select skills to install (Space to toggle, Enter to confirm):',
          options: SKILLS.map(skill => ({ value: skill, label: skill })),
          required: true
        });

        if (p.isCancel(selectedSkills)) continue;
      }

      const destInput = await p.text({
        message: 'Enter destination directory:',
        placeholder: './skills',
        defaultValue: './skills'
      });

      if (p.isCancel(destInput)) continue;

      const dest = destInput || './skills';

      // Perform installation
      p.log.info(`Installing to: ${path.resolve(dest)}...`);
      let successCount = 0;
      for (const skill of selectedSkills) {
        if (installSkill(skill, dest)) {
          successCount++;
        }
      }
      p.outro(`✓ Complete! Successfully installed ${successCount}/${selectedSkills.length} skills maintaining folder structure.`);

    } else if (choice === 'configure_mcp') {
      const destInput = await p.text({
        message: 'Enter the path of the installed skills folder to mount:',
        placeholder: './skills',
        defaultValue: './skills'
      });

      if (p.isCancel(destInput)) continue;

      const dest = destInput || './skills';
      configureClaudeMCP(dest);

    } else if (choice === 'guidelines') {
      printGuidelines();
      await p.text({
        message: 'Press Enter to return to the main menu...'
      });
    }
  }
}

// Argument Parser entry point
function main() {
  const args = process.argv.slice(2);
  
  let showHelpFlag = false;
  let showVersionFlag = false;
  let allFlag = false;
  let destDir = './skills';
  let specificSkill = null;
  let mcpFlag = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      showHelpFlag = true;
    } else if (arg === '-v' || arg === '--version') {
      showVersionFlag = true;
    } else if (arg === '-a' || arg === '--all') {
      allFlag = true;
    } else if (arg === '-d' || arg === '--dest') {
      destDir = args[++i];
    } else if (arg === '-s' || arg === '--skill') {
      specificSkill = args[++i];
    } else if (arg === '-m' || arg === '--mcp') {
      mcpFlag = true;
    }
  }
  
  if (showHelpFlag) {
    printHelp();
    return;
  }
  
  if (showVersionFlag) {
    console.log(`v${VERSION}`);
    return;
  }
  
  // If arguments were provided, run non-interactively
  if (allFlag || specificSkill || mcpFlag) {
    if (specificSkill) {
      installSkill(specificSkill, destDir);
    } else if (allFlag) {
      installAllSkills(destDir);
    }
    
    if (mcpFlag) {
      configureClaudeMCP(destDir);
    }
    return;
  }
  
  // Default to interactive mode
  runInteractive();
}

main();
