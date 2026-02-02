import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import logger from '../utils/logger.js';

export interface ValidationErrorResponse {
  error: 'Validation failed';
  details: Array<{
    field: string;
    message: string;
  }>;
}

const formatZodError = (error: ZodError): ValidationErrorResponse => {
  return {
    error: 'Validation failed',
    details: error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message
    }))
  };
};

export const validateBody = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = formatZodError(error);
        logger.warn({ path: req.path, errors: formatted.details }, 'Validation failed');
        res.status(400).json(formatted);
        return;
      }
      next(error);
    }
  };
};

export const validateParams = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = formatZodError(error);
        logger.warn({ path: req.path, errors: formatted.details }, 'Param validation failed');
        res.status(400).json(formatted);
        return;
      }
      next(error);
    }
  };
};

export const validateQuery = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = formatZodError(error);
        logger.warn({ path: req.path, errors: formatted.details }, 'Query validation failed');
        res.status(400).json(formatted);
        return;
      }
      next(error);
    }
  };
};
