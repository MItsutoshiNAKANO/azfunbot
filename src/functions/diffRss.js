const { app } = require('@azure/functions');

app.timer('diffRss', {
    schedule: '1 1,14 9 * * *',
    handler: (myTimer, context) => {
        context.log('Timer function processed request.');
    }
});
