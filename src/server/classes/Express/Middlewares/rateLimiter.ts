// Temporary rate-limit implementation
// Reference: https://blog.logrocket.com/rate-limiting-node-js/

import rateLimit from 'express-rate-limit';

export const rateLimiterUsingThirdParty = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'You have exceeded the 10 requests in 60 seconds limit!',
    standardHeaders: true,
    legacyHeaders: false
});
