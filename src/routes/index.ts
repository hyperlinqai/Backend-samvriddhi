import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { attendanceRouter } from '../modules/attendance/attendance.routes';
import { userRouter } from '../modules/user/user.routes';
import { visitRouter } from '../modules/visit/visit.routes';
import { leadRouter } from '../modules/lead/lead.routes';
import { expenseRouter } from '../modules/expense/expense.routes';
import { routeManagementRouter } from '../modules/route-management/route-management.routes';
import { discrepancyRouter } from '../modules/discrepancy/discrepancy.routes';
import { auditRouter } from '../modules/audit/audit.routes';
import { entityRouter } from '../modules/entity/entity.routes';
import roleRouter from '../modules/role/role.routes';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/entities', entityRouter);
apiRouter.use('/attendance', attendanceRouter);
apiRouter.use('/visits', visitRouter);
apiRouter.use('/leads', leadRouter);
apiRouter.use('/expenses', expenseRouter);
apiRouter.use('/routes', routeManagementRouter);
apiRouter.use('/discrepancies', discrepancyRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/roles', roleRouter);

export { apiRouter };
