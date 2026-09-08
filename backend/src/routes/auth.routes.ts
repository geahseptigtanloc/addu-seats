import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import { passport } from '../config/passport';
import { authSession } from '../middlewares/session';
import * as authController from '../controllers/auth.controller';

const router = Router();

router.use(authSession);

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  }) as RequestHandler,
);

router.get('/google/callback', (req: Request, res: Response, next: NextFunction) => {
  (
    passport.authenticate(
      'google',
      { session: false },
      (err: unknown, user?: Express.User | false, info?: { message?: string }) => {
        if (err) {
          next(err);
          return;
        }
        if (!user) {
          authController.googleCallbackFailure(res, info?.message ?? 'authentication_failed');
          return;
        }
        void authController.googleCallbackSuccess(user, res, next);
      },
    ) as RequestHandler
  )(req, res, next);
});

router.post('/exchange', authController.exchangeCode);

export default router;
