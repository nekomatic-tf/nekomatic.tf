// Temporary rate-limit implementation
// Reference: https://blog.logrocket.com/rate-limiting-node-js/

import rateLimit from 'express-rate-limit';

export const rateLimiterUsingThirdParty = rateLimit({
    windowMs: 1000,
    max: 5,
    message: 'You have exceeded the 5 requests/second limit!',
    standardHeaders: true,
    legacyHeaders: false
});
