#  typing-test

## how to : generate scss from json
1. `npm install --save-dev nodemon` → install nodemon as a dev dependency
2. `npm install json5 --save-dev` → install json5
3. set up your "**package.json**" *(use my as an example / copy&paste my "package.json")*
4. `npm run build-config` → generates the **config.scss**
> 	**you should get the following response in terminal:**
> ✅ css/scss/_config.scss erfolgreich generiert!
5. `npm run watch-config` → automatically regenerates as soon as you save **config.json** 
---
---
**projekt-root/**
- │
- └─ **css/**
- │ └─ **scss/**
- │ㅤ└─ **config.json** *← centraal* configKommentaren#
- │ㅤ└─ **_config.scss** *← generated scss*
- │ㅤ└─ ... *← other styles and stuff*
- │
- └─ **generate-scss.js** *← script for convertion*
- └─ **package.json** *← node/NPM configuration*
- └─ **node_modules/** *← automatically installed by* npm