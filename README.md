# klg-request
http request util

## QuickStart

### Install

```
npm i klg-request --save
```

### Usage

参考 src/Request.test

### Test

```bash
$ npm i
$ npm test
```

### Changelog
1.0.0 add postJson functionality, add putJson functionality


2.0.0
- rename postJson to post
- rename putJson to put
- add get functionality, http get
- add retries option, The maximum amount of times to retry the operation. Default is 5. Seting this to 1 means do it once,
- add factor option, The exponential factor to use. Default is 2.
- add minTimeout option, The number of milliseconds before starting the first retry. Default is 1000.
- change retryWhen500 option to retryWhen50x, support all 50* http status


2.1.0 fix get functionality，support query parameter

2.2.0 fix get functionality，support options parameter
