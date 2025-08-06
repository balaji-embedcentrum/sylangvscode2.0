/*
 * CURSOR AI INTEGRATION DISCOVERY SCRIPT
 * 
 * PURPOSE: Discover available Cursor AI commands for integration
 * USAGE: Copy and paste this entire script into Cursor Developer Console
 *        (Help > Toggle Developer Tools > Console tab)
 * 
 * This script is completely separate from the main extension
 * and can be safely deleted after discovery.
 */

console.log('🚀 CURSOR AI INTEGRATION DISCOVERY v1.0');
console.log('================================================');

// Store results for easy access
const discoveryResults = {
  cursorCommands: [],
  chatCommands: [],
  workbenchCommands: [],
  availableCommands: [],
  extensionInfo: {},
  testResults: {}
};

async function discoverCursorCommands() {
  try {
    console.log('\n📋 Step 1: Getting all available commands...');
    
    // Get all commands
    const allCommands = await vscode.commands.getCommands();
    discoveryResults.availableCommands = allCommands;
    console.log(`✅ Found ${allCommands.length} total commands`);

    // Filter for Cursor-specific commands
    console.log('\n🔍 Step 2: Filtering for Cursor AI commands...');
    
    const cursorKeywords = [
      'cursor', 'chat', 'ai', 'anthropic', 'claude', 
      'composer', 'tab', 'completion', 'agent', 'edit'
    ];
    
    discoveryResults.cursorCommands = allCommands.filter(cmd => {
      const lower = cmd.toLowerCase();
      return cursorKeywords.some(keyword => lower.includes(keyword));
    });
    
    console.log(`🤖 Found ${discoveryResults.cursorCommands.length} Cursor AI related commands:`);
    discoveryResults.cursorCommands.forEach(cmd => console.log(`   - ${cmd}`));

    // Filter for chat-specific commands
    discoveryResults.chatCommands = allCommands.filter(cmd => 
      cmd.toLowerCase().includes('chat') || 
      cmd.toLowerCase().includes('composer')
    );
    
    console.log(`\n💬 Found ${discoveryResults.chatCommands.length} Chat related commands:`);
    discoveryResults.chatCommands.forEach(cmd => console.log(`   - ${cmd}`));

    // Filter for workbench commands that might control panels
    discoveryResults.workbenchCommands = allCommands.filter(cmd => 
      cmd.startsWith('workbench.') && (
        cmd.includes('panel') || 
        cmd.includes('view') || 
        cmd.includes('sidebar') ||
        cmd.includes('chat')
      )
    );
    
    console.log(`\n🖥️ Found ${discoveryResults.workbenchCommands.length} Workbench UI commands:`);
    discoveryResults.workbenchCommands.forEach(cmd => console.log(`   - ${cmd}`));

  } catch (error) {
    console.error('❌ Error getting commands:', error);
  }
}

async function testCursorCommands() {
  console.log('\n🧪 Step 3: Testing key commands...');
  
  // Define test commands based on Cursor documentation
  const testCommands = [
    // Chat/Composer controls
    { cmd: 'workbench.action.toggleSidebarVisibility', desc: 'Toggle Sidebar' },
    { cmd: 'workbench.action.togglePanel', desc: 'Toggle Panel' },
    { cmd: 'workbench.action.chat.open', desc: 'Open Chat' },
    { cmd: 'workbench.view.chat', desc: 'Focus Chat View' },
    { cmd: 'workbench.panel.chat.focus', desc: 'Focus Chat Panel' },
    { cmd: 'composer.toggle', desc: 'Toggle Composer' },
    { cmd: 'composer.focus', desc: 'Focus Composer' },
    { cmd: 'cursor.chat.focus', desc: 'Focus Cursor Chat' },
    { cmd: 'cursor.composer.focus', desc: 'Focus Cursor Composer' },
    
    // Edit controls
    { cmd: 'cursor.edit.toggle', desc: 'Toggle Edit Mode' },
    { cmd: 'workbench.action.showCommands', desc: 'Show Command Palette' },
  ];

  discoveryResults.testResults = {};
  
  for (const test of testCommands) {
    try {
      const exists = discoveryResults.availableCommands.includes(test.cmd);
      discoveryResults.testResults[test.cmd] = {
        exists,
        description: test.desc,
        tested: false,
        error: null
      };
      
      const status = exists ? '✅ EXISTS' : '❌ NOT FOUND';
      console.log(`   ${test.cmd}: ${status} (${test.desc})`);
      
    } catch (error) {
      discoveryResults.testResults[test.cmd] = {
        exists: false,
        description: test.desc,
        tested: false,
        error: error.message
      };
      console.log(`   ${test.cmd}: ❌ ERROR - ${error.message}`);
    }
  }
}

async function analyzeExtensions() {
  console.log('\n📦 Step 4: Analyzing extensions...');
  
  try {
    const extensions = vscode.extensions.all;
    console.log(`Found ${extensions.length} total extensions`);
    
    // Look for AI/Cursor related extensions
    const aiExtensions = extensions.filter(ext => {
      const id = ext.id.toLowerCase();
      const name = (ext.packageJSON.displayName || '').toLowerCase();
      return id.includes('cursor') || 
             id.includes('ai') || 
             id.includes('chat') ||
             id.includes('anthropic') ||
             id.includes('claude') ||
             name.includes('cursor') ||
             name.includes('ai');
    });
    
    console.log(`\n🤖 Found ${aiExtensions.length} AI/Cursor related extensions:`);
    
    aiExtensions.forEach(ext => {
      const info = {
        id: ext.id,
        active: ext.isActive,
        name: ext.packageJSON.displayName || ext.packageJSON.name,
        version: ext.packageJSON.version,
        commands: ext.packageJSON.contributes?.commands || [],
        keybindings: ext.packageJSON.contributes?.keybindings || []
      };
      
      discoveryResults.extensionInfo[ext.id] = info;
      
      console.log(`   📋 ${info.name} (${ext.id})`);
      console.log(`      Active: ${info.active}`);
      console.log(`      Version: ${info.version}`);
      console.log(`      Commands: ${info.commands.length}`);
      
      if (info.commands.length > 0) {
        console.log(`      Command List:`);
        info.commands.forEach(cmd => {
          console.log(`         - ${cmd.command}: ${cmd.title}`);
        });
      }
      
      if (info.keybindings.length > 0) {
        console.log(`      Keybindings: ${info.keybindings.length}`);
        info.keybindings.slice(0, 3).forEach(kb => {
          console.log(`         - ${kb.key}: ${kb.command}`);
        });
        if (info.keybindings.length > 3) {
          console.log(`         ... and ${info.keybindings.length - 3} more`);
        }
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error analyzing extensions:', error);
  }
}

function checkGlobalAPIs() {
  console.log('\n🌐 Step 5: Checking global APIs...');
  
  const globals = [
    'vscode',
    'acquireVsCodeApi',
    'cursor',
    'anthropic',
    'claude'
  ];
  
  globals.forEach(global => {
    const available = typeof window !== 'undefined' && typeof window[global] !== 'undefined';
    console.log(`   ${global}: ${available ? '✅ Available' : '❌ Not Available'}`);
  });
  
  // Check for Cursor-specific globals that might exist
  if (typeof window !== 'undefined') {
    const windowProps = Object.getOwnPropertyNames(window).filter(prop => 
      prop.toLowerCase().includes('cursor') || 
      prop.toLowerCase().includes('anthropic') ||
      prop.toLowerCase().includes('claude')
    );
    
    if (windowProps.length > 0) {
      console.log('\n🔍 Found Cursor-related window properties:');
      windowProps.forEach(prop => console.log(`   - window.${prop}`));
    }
  }
}

function generateIntegrationPlan() {
  console.log('\n📋 Step 6: Generating Integration Plan...');
  console.log('===========================================');
  
  // Analyze discovered commands for integration opportunities
  const chatCommands = discoveryResults.chatCommands;
  const workbenchCommands = discoveryResults.workbenchCommands;
  
  console.log('\n🎯 RECOMMENDED INTEGRATION APPROACH:');
  console.log('\n1. PRIMARY CHAT TRIGGERS:');
  
  if (chatCommands.length > 0) {
    console.log('   Based on discovered chat commands:');
    chatCommands.slice(0, 3).forEach(cmd => {
      console.log(`   - vscode.commands.executeCommand('${cmd}')`);
    });
  }
  
  console.log('\n2. PANEL CONTROL:');
  workbenchCommands.slice(0, 3).forEach(cmd => {
    console.log(`   - vscode.commands.executeCommand('${cmd}')`);
  });
  
  console.log('\n3. TEXT INJECTION STRATEGIES:');
  console.log('   - Clipboard + Paste simulation');
  console.log('   - Temporary file creation and opening');
  console.log('   - VSCode editor text insertion API');
  
  console.log('\n4. CONTEXT ATTACHMENT:');
  console.log('   - File URI attachment via VSCode API');
  console.log('   - Text selection and clipboard sharing');
  console.log('   - Workspace file system access');
  
  console.log('\n📊 DISCOVERY SUMMARY:');
  console.log(`   Total Commands: ${discoveryResults.availableCommands.length}`);
  console.log(`   Cursor Commands: ${discoveryResults.cursorCommands.length}`);
  console.log(`   Chat Commands: ${discoveryResults.chatCommands.length}`);
  console.log(`   Extensions: ${Object.keys(discoveryResults.extensionInfo).length}`);
}

// Main execution
async function runDiscovery() {
  console.log('Starting Cursor AI Integration Discovery...\n');
  
  if (typeof vscode === 'undefined') {
    console.error('❌ VSCode API not available. Please run this in Cursor Developer Console.');
    return;
  }
  
  await discoverCursorCommands();
  await testCursorCommands();
  await analyzeExtensions();
  checkGlobalAPIs();
  generateIntegrationPlan();
  
  console.log('\n✅ Discovery Complete!');
  console.log('\n💾 Results stored in: window.discoveryResults');
  console.log('📋 Access via: console.log(window.discoveryResults)');
  
  // Make results globally accessible
  window.discoveryResults = discoveryResults;
}

// Auto-run if in correct environment
if (typeof vscode !== 'undefined') {
  runDiscovery();
} else {
  console.log('❌ Please run this script in Cursor Developer Console');
  console.log('   Help > Toggle Developer Tools > Console tab');
} 