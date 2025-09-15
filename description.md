This is meant ot be a wrapper around containers (devcontainers prefferably) that would serve as a development environment for Claude Code CLI and happy-coder. Why? To sandbox it.



# Wrapper Requirements
1. Needs to support iteractive mode
2. Needs to support claude code and happy-coder CLI (claude and happy respectively)
3. Needs to remember what's the name of docker container per workspace and needs to be persisted.
  - add .aisanity file with the container name as one of the config options, default to cwd + git branch name ({workspace}) just make them sanitized.
  - make the .aisanity YAML based for now that will be the only config option given
4. {workspace} is {folder_name}_{branch_name} sanitized.
5. All shared dirs need to be mounted


# Requirements

1. The currently working directory needs to be mounted inside the container as /workspace
2. Shared claude config located in ~/.aisanity/claude/.claude_{workspace} needs to be also mounted in the container and available for `claude` to use. (should be ~/.claude inside container)
3. There should be helper cli commands to:
  - spawn new container for iteractive work (to alter it, similar to docker --it), it's ok to pass docker options to it. But keep the mounts etc.
  - spawn new container that will be destroyed after use (similar to docker --rm), it's ok to pass docker options to it. But keep the mounts etc.
4. An "init" command that will create the .aisanity file with the default configuration. The command should also create ~/.aisanity/claude/.claude_{workspace} that is copied from default config in ~/.aisanity/claude/.claude_default
5. All shared directories need to be mounted inside the container.
6. Default claude config is located in ~/.aisanity/claude/.claude_default and is copied to ~/.aisanity/claude/.claude_{workspace} when the workspace is initialized.
7. None of the shared dirs should be permanently added to the container.
8. We should use devcontainers as much as possible to achieve seamless integration with IDEs etc.
9. ./.aisanity should support ENV variables also



# Sample usage

## From HOST perspective

`aisanity claude`: should launch claude process INSIDE the container read from `.aisanity` file. Should also add `--dangerous-skip-permissions` to claude invocation.

`aisanity init`: should create the .aisanity file with the default configuration and copy the default claude config to the workspace config.

`aisanity happy`: should launch happy process INSIDE the container read from `.aisanity` file. Should also add `--dangerous-skip-permissions` to invocation.

`aisanity stop`: should stop all containers used for this workspace

`aisanity status`: should display the status of all containers used for this workspace

`aisanity run`: should run a new container for interactive work, similar to docker --it, and keep the mounts etc. Pass additional options to the container.

`aisanity once`: should run a new container that will be destroyed after use (similar to docker --rm), it's ok to pass docker options to it. But keep the mounts etc.
