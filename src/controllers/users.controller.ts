import { Request, Response } from 'express';
import prisma from '../prisma';
import { PrismaClientValidationError } from '@prisma/client/runtime/library';

export const getUser = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  res.json({
    data: user,
    error: null
  });
};

export const updateUser = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { name, gender } = req.body;

  try {
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name,
        gender
      },
    });

    res.json({
      data: null,
      error: null
    }); 
  } catch (e) {
    if (e instanceof PrismaClientValidationError) {
      res.status(400).json({
        data: null,
        error: "Invalid input"
      });

      return;
    }

    res.status(500).json({
      data: null,
      error: 'Failed to update user'
    });

    return;
  }
};