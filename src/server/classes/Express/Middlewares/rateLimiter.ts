// Temporary rate-limit implementation
// Reference: https://blog.logrocket.com/rate-limiting-node-js/

import rateLimit from 'express-rate-limit';

export const rateLimiterUsingThirdParty = rateLimit({
    windowMs: 1000,
    max: 1,
    message: 'You have exceeded the 1 request/second limit!',
    standardHeaders: true,
    legacyHeaders: false
});
