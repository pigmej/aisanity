import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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
        await setupOpencodeConfig(cwd);

        // Detect project type and create devcontainer
        const projectType = detectProjectType(cwd);
        const devcontainerDir = path.join(cwd, '.devcontainer');
        if (!fs.existsSync(devcontainerDir)) {
          fs.mkdirSync(devcontainerDir, { recursive: true });
        }

        const template = getDevContainerTemplate(projectType);
        if (template) {
          const devcontainerPath = path.join(devcontainerDir, 'devcontainer.json');
          fs.writeFileSync(devcontainerPath, template.devcontainerJson, 'utf8');
          const projectTypeMessage = projectType === 'unknown' ? 'unknown project type' : `${projectType} project`;
          console.log(`Created devcontainer for ${projectTypeMessage}`);

          if (template.dockerfile) {
            const dockerfilePath = path.join(devcontainerDir, 'Dockerfile');
            fs.writeFileSync(dockerfilePath, template.dockerfile, 'utf8');
            console.log(`Created Dockerfile for ${projectTypeMessage}`);
          }
        }

       console.log(`Workspace ${workspaceName} initialized successfully!`);
       console.log(`You can now use 'aisanity run' to start working in the container.`);

    } catch (error) {
      console.error('Failed to initialize workspace:', error);
      process.exit(1);
    }
  });