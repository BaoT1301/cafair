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


### Output 1
file:///var/folders/1v/6m5fyhyd6ynf85g5h1kfqmwm0000gn/T/tmp1k8g5p_4_nova_act_logs/019cab68-2b3b-738a-8c2c-86cf243e822e/act_019cab68-92af-7470-a670-a3a8dd4b540f_You_are_helping_gather_visible.html

```bash
(.venv) macbook@Stephens-McDonalds-air cafair % python apps/llm/agents/scripts/run-social-capture-nova.py \
  "Nguyen Phan Nguyen" \
  --linkedin "https://www.linkedin.com/in/nguyenpn1/" \
  --github "https://github.com/ngstephen1" \
  --web-query "Nguyen Phan Nguyen hackathon" \
  --web-query "Nguyen Phan Nguyen developer" \
  --local-browser \
  --manual-linkedin-login \
  --debug-logs \
  --prefer-chrome \
  --pretty
[WARN] Ignoring NOVA_ACT_CHROME_USER_DATA_DIR / NOVA_ACT_CHROME_PROFILE_DIRECTORY in local mode. This NovaAct SDK path does not support Chrome profile reuse via --user-data-dir.
[INFO] Local browser starting page: https://www.linkedin.com/feed/
[INFO] Prefer Chrome enabled: True
[INFO] Chrome executable hint set: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
[INFO] NOVA_ACT_BROWSER_ARGS: --remote-debugging-port=9222 --no-first-run --no-default-browser-check
[INFO] Current NovaAct local mode uses an isolated Playwright-launched browser. It prefers Chrome/Chromium, but it does not reliably reuse your signed-in Chrome profile.
Running on Nova Act Free Version. Amazon collects data on interactions on this version. See more details at nova.amazon.com/act

2026-03-01 16:57:36,489 - nova_act.types.workflow - INFO - Created workflow run 019cab68-2a76-7da7-aff2-75c581c3f279 with model nova-act-preview.

start session 019cab68-2b3b-738a-8c2c-86cf243e822e on https://www.linkedin.com/feed/ logs dir /var/folders/1v/6m5fyhyd6ynf85g5h1kfqmwm0000gn/T/tmp1k8g5p_4_nova_act_logs/019cab68-2b3b-738a-8c2c-86cf243e822e

[16:57:43] 
[MANUAL STEP] LinkedIn manual login mode is enabled.
The browser is open on LinkedIn. Please finish logging into your LinkedIn account manually,
navigate until you can see the authenticated LinkedIn UI (for example the feed page),
then press Enter here in the terminal so Nova Act can continue from the signed-in session...

822e> act("...You are helping gather visible public profile information for research and profile review.
822e> Only inspect information that is already visible in the current browser session.
822e> Narrate your actions briefly while you move so the operator can follow along.
822e> Scroll only when needed. Avoid repetitive scrolling. Prefer targeted clicks and concise movement.
822e> If you complete a stage, move to the next stage immediately instead of revisiting earlier sections repeatedly.
822e> Primary candidate name: Nguyen Phan Nguyen.
822e> LINKEDIN STAGE: NGUYEN PHAN NGUYEN PROFILE
822e> 1. You are starting from an already authenticated LinkedIn session after the human operator logged in manually.
822e> 2. Stay inside the current LinkedIn tab.
822e> 3. First, in the LinkedIn global search bar, search this exact query: Bao Tran George Mason University
822e> 4. On ")
822e> 💭 ...16:58:08]  
822e> think("I am on the LinkedIn profile page for Nguyen Phan Nguyen. The task is to search for Bao Tran George Mason University and send a message to the first result. I need to search for Bao Tran George Mason University. I see the LinkedIn global search bar at the top of the page. I should type 'Bao Tran George Mason University' into the LinkedIn global search bar to populate it.");
822e> agentType("Bao Tran George Mason University", "<box>8,197,43,484</box>");
822e> 👀 ...16:58:12]  
822e> 💭 ...[16:58:15] 
822e> think("The search bar is now populated with 'Bao Tran George Mason University', so my last action was successful. I see a search suggestion for 'bao tran' with the title 'AI Software Intern @ Deepiri'. I should click the 'bao tran' search suggestion to navigate to the profile page.");
822e> agentClick("<box>59,241,81,297</box>");
822e> 👀 ...[16:58:20] 
822e> 💭 ...[16:58:23] 
822e> think("I am now on the profile page for Bao Tran, so my last action was successful. I need to send a message to Bao Tran. I see a Message button on the profile page. I should click the Message button to start a message to Bao Tran.");
822e> agentClick("<box>520,172,553,290</box>");
822e> 👀 ...[16:58:28] 
822e> 💭 ...16:58:32]  
822e> think("A message composition window is now visible, so my last action was successful. I see the message field is empty. I need to type the message 'Test002: Hi Bao Tran, I think you are a very good fit for our Cloud Engineer New Grad in the Cloud Mobile team at XYZZZZ.' into the message field. I should type 'Test002: Hi Bao Tran, I think you are a very good fit for our Cloud Engineer New Grad in the Cloud Mobile team at XYZZZZ.' into the message field to populate it.");
822e> agentType("Test002: Hi Bao Tran, I think you are a very good fit for our Cloud Engineer New Grad in the Cloud Mobile team at XYZZZZ.", "<box>628,623,714,1080</box>");
822e> 👀 ...6:58:35] ] 
822e> 💭 ...[16:58:38] 
822e> think("The message field is now populated with 'Test002: Hi Bao Tran, I think you are a very good fit for our Cloud Engineer New Grad in the Cloud Mobile team at XYZZZZ.', so my last action was successful. I need to send the message. I see a Send button in the message composition window. I should click the Send button to send the message to Bao Tran.");
822e> agentClick("<box>748,1009,777,1072</box>");
822e> 👀 ...[16:58:43] 
822e> 💭 ...6:58:46] ] 
822e> think("The message has been sent, as indicated by the timestamp next to the message. Therefore, my last action was successful. I need to search for Nguyen Phan Nguyen Virginia Tech. I see the LinkedIn global search bar at the top of the page. I should type 'Nguyen Phan Nguyen Virginia Tech' into the LinkedIn global search bar to populate it.");
822e> agentType("Nguyen Phan Nguyen Virginia Tech", "<box>8,192,43,476</box>");
822e> 👀 ...6:58:50] ] 
822e> 💭 ...6:58:53] ] 
822e> think("The search bar is now populated with 'Nguyen Phan Nguyen Virginia Tech', so my last action was successful. I see a search suggestion for 'nguyen phan nguyen virginia tech'. I should click the 'nguyen phan nguyen virginia tech' search suggestion to navigate to the search results page.");
822e> agentClick("<box>103,243,127,490</box>");
822e> 👀 ...[16:58:59] 
822e> 💭 ...[16:59:02] 
822e> think("I am now on the search results page for 'Nguyen Phan Nguyen Virginia Tech', so my last action was successful. I see the first result for Nguyen Phan Nguyen, with the title 'ICLR 2026 | SHP 2025 | Virginia Tech | Future AI Musician'. I should click the first result for Nguyen Phan Nguyen to navigate to the profile page.");
822e> agentClick("<box>236,460,257,621</box>");
822e> 👀 ...6:59:09] ] 
822e> 💭 ...[16:59:13] 
822e> think("I am now on the profile page for Nguyen Phan Nguyen, so my last action was successful. I need to capture the top card information for Nguyen Phan Nguyen. The top card information is visible: Headline: ICLR 2026 | SHP 2025 | Virginia Tech | Future AI Musician, Location: United States, Connection count: 500+ connections, Employer: None visible, School: Virginia Tech, Visible public links: https://dot.cards/steegle. I should remember this information for the final report. I need to scroll down to view the About, Activity, Experience, Education, Featured, and Skills sections. I should scroll down the page to find the About section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...[16:59:16] 
822e> 💭 ...6:59:20] ] 
822e> think("The page has not changed, so my last action was unsuccessful. I need to close the message window to view the profile. I see an 'X' button in the top right corner of the message window. I should click the 'X' button in the top right corner of the message window to close the message window.");
822e> agentClick("<box>113,1082,135,1105</box>");
822e> 👀 ...6:59:24] ] 
822e> 💭 ...6:59:27] ] 
822e> think("The message window is now closed, so my last action was successful. I need to scroll down to view the About, Activity, Experience, Education, Featured, and Skills sections. I should scroll down the page to find the About section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...16:59:31]  
822e> 💭 ...6:59:35] ] 
822e> think("The page has scrolled down and the About section is now visible, so my last action was successful. I see the About section, but it is not fully expanded. I see a 'see more' link in the About section. I should click the 'see more' link in the About section to expand the About section.");
822e> agentClick("<box>416,868,434,932</box>");
822e> 👀 ...6:59:38] ] 
822e> 💭 ...[16:59:41] 
822e> think("The About section is now expanded, so my last action was successful. I need to scroll down to view the Experience, Education, Featured, and Skills sections. I should scroll down the page to find the Experience section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...6:59:45] ] 
822e> 💭 ...6:59:48] ] 
822e> think("The page has scrolled down and the Activity section is now visible, so my last action was successful. I need to scroll down to view the Experience, Education, Featured, and Skills sections. I should scroll down the page to find the Experience section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...6:59:52] ] 
822e> 💭 ...6:59:55] ] 
822e> think("The page has scrolled down and the Experience section is now visible, so my last action was successful. I see the Experience section, but it is not fully expanded. I see a 'Show all' button in the Experience section. I should click the 'Show all' button in the Experience section to expand the Experience section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...[16:59:58] 
822e> 💭 ...[17:00:01] 
822e> think("The Experience section is now expanded, so my last action was successful. I need to scroll down to view the Education, Featured, and Skills sections. I should scroll down the page to find the Education section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...7:00:05] ] 
822e> 💭 ...7:00:09] ] 
822e> think("The page has scrolled down and the Education section is now visible, so my last action was successful. I see the Education section, but it is not fully expanded. I see a 'see more' link in the Education section. I should click the 'see more' link in the Education section to expand the Education section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...7:00:12] ] 
822e> 💭 ...[17:00:15] 
822e> think("The Education section is now expanded, so my last action was successful. I need to scroll down to view the Featured and Skills sections. I should scroll down the page to find the Featured section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...[17:00:18] 
822e> 💭 ...[17:00:21] 
822e> think("The page has scrolled down and the Licenses & certifications section is now visible, so my last action was successful. I need to scroll down to view the Featured and Skills sections. I should scroll down the page to find the Featured section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...7:00:25] ] 
822e> 💭 ...7:00:28] ] 
822e> think("The page has scrolled down and the Skills section is now visible, so my last action was successful. I see the Skills section, but it is not fully expanded. I see a 'Show all' button in the Skills section. I should click the 'Show all' button in the Skills section to expand the Skills section.");
822e> agentClick("<box>503,476,524,624</box>");
822e> 👀 ...17:00:32]  
822e> 💭 ...7:00:36] ] 
822e> think("The Skills section is now expanded, so my last action was successful. I need to scroll down to view the Featured section. I should scroll down the page to find the Featured section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...7:00:39] ] 
822e> 💭 ...7:00:43] ] 
822e> think("The page has scrolled down and more Skills are now visible, so my last action was successful. I need to scroll down to view the Featured section. I should scroll down the page to find the Featured section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...[17:00:46] 
822e> 💭 ...7:00:49] ] 
822e> think("The page has scrolled down and more Skills are now visible, so my last action was successful. I need to scroll down to view the Featured section. I should scroll down the page to find the Featured section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...7:00:53] ] 
822e> 💭 ...7:00:56] ] 
822e> think("The page has scrolled down and more Skills are now visible, so my last action was successful. I need to scroll down to view the Featured section. I should scroll down the page to find the Featured section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...[17:01:00] 
822e> 💭 ...7:01:03] ] 
822e> think("The page has scrolled down and more Skills are now visible, so my last action was successful. I need to scroll down to view the Featured section. I should scroll down the page to find the Featured section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...[17:01:06] 
822e> 💭 ...7:01:10] ] 
822e> think("The page has scrolled down and more Skills are now visible, so my last action was successful. I need to scroll down to view the Featured section. I should scroll down the page to find the Featured section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...[17:01:13] 
822e> 💭 ...7:01:16] ] 
822e> think("The page has scrolled down and more Skills are now visible, so my last action was successful. I need to scroll down to view the Featured section. I should scroll down the page to find the Featured section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...[17:01:19] 
822e> 💭 ...7:01:23] ] 
822e> think("The page has scrolled down and more Skills are now visible, so my last action was successful. I need to scroll down to view the Featured section. I should scroll down the page to find the Featured section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...[17:01:26] 
822e> 💭 ...7:01:29] ] 
822e> think("The page has scrolled down and more Skills are now visible, so my last action was successful. I need to scroll down to view the Featured section. I should scroll down the page to find the Featured section.");
822e> agentScroll("down", "<box>0,0,788,1440</box>");
822e> 👀 ...7:01:33] ] 
822e> 💭 ...17:01:37]  
822e> think("The page has scrolled down and the footer is now visible, so my last action was successful. I have reached the bottom of the page, as indicated by the slider, and have not found the Featured section. I have found the top card information, About section, Experience section, Education section, and Skills section. The strongest visible findings from Nguyen Phan Nguyen are: ICLR 2026 | SHP 2025 | Virginia Tech | Future AI Musician, 500+ connections, Virginia Tech, https://dot.cards/steegle, and the skills listed in the Skills section. I need to navigate to the GitHub profile. I should go to the URL https://github.com/ngstephen1 to navigate to the GitHub profile.");
822e> goToUrl("https://github.com/ngstephen1");
822e> 👀 ...[17:01:43] 

822e> ** View your act run here: /var/folders/1v/6m5fyhyd6ynf85g5h1kfqmwm0000gn/T/tmp1k8g5p_4_nova_act_logs/019cab68-2b3b-738a-8c2c-86cf243e822e/act_019cab68-92af-7470-a670-a3a8dd4b540f_You_are_helping_gather_visible.html
