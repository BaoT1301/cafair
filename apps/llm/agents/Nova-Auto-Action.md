## Stephen Current Status

### to-do: 
1. make code to see the actions working on browser and logs in terminal, integrate BRock/SerpAPI/PlayWright
2. update the Nova workflow polling script

### workflow mode is starting correctly

### Command
```bash
--local-browser \ is optional, to use api key flow, to view browser directly on local machine
default without --local-browser \ means using Workflow mode, polling remotely.

python apps/llm/agents/scripts/run-social-capture-nova.py \
  "Nguyen Phan Nguyen" \
  --linkedin "https://www.linkedin.com/in/nguyenpn1/" \
  --github "https://github.com/ngstephen1" \
  --web-query "Nguyen Phan Nguyen Virginia Tech" \
  --web-query "Nguyen Phan Nguyen Software Engineer" \
  --local-browser \
  --debug-logs \
  --prefer-chrome \
  --pretty
```


### Output