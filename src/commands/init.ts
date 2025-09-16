import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { getWorkspaceName, createAisanityConfig, setupOpencodeConfig, detectProjectType } from '../utils/config';
import { getDevContainerTemplate } from '../utils/devcontainer-templates';

export const initCommand = new Command('init')
  .description('Initialize workspace configuration and development environment')
  .action(async () => {
    try {
      const cwd = process.cwd();
      const workspaceName = getWorkspaceName(cwd);

      console.log(`Initializing aisanity workspace: ${workspaceName}`);

      // Create .aisanity config file
      const configPath = path.join(cwd, '.aisanity');
      if (fs.existsSync(configPath)) {
        console.log('.aisanity file already exists');
      } else {
        const config = createAisanityConfig(workspaceName);
        fs.writeFileSync(configPath, config, 'utf8');
        console.log(`Created .aisanity config file`);
      }



       // Setup opencode configuration
       await setupOpencodeConfig(cwd, workspaceName);

       // Detect project type and create devcontainer if applicable
       const projectType = detectProjectType(cwd);
       if (projectType !== 'unknown') {
         const devcontainerDir = path.join(cwd, '.devcontainer');
         if (!fs.existsSync(devcontainerDir)) {
           fs.mkdirSync(devcontainerDir, { recursive: true });
         }

         const template = getDevContainerTemplate(projectType);
         if (template) {
           const devcontainerPath = path.join(devcontainerDir, 'devcontainer.json');
           fs.writeFileSync(devcontainerPath, template.devcontainerJson, 'utf8');
           console.log(`Created devcontainer for ${projectType} project`);

           if (template.dockerfile) {
             const dockerfilePath = path.join(devcontainerDir, 'Dockerfile');
             fs.writeFileSync(dockerfilePath, template.dockerfile, 'utf8');
             console.log(`Created Dockerfile for ${projectType} project`);
           }
         }
       } else {
         console.log('No specific project type detected. Devcontainer not created.');
       }

       console.log(`Workspace ${workspaceName} initialized successfully!`);
       console.log(`You can now use 'aisanity run' to start working in the container.`);

    } catch (error) {
      console.error('Failed to initialize workspace:', error);
      process.exit(1);
    }
  });