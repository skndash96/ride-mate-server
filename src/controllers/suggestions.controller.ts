import { Request, Response } from 'express';
import prisma from '../prisma';
import { Status } from '@prisma/client';

export const getSuggestions = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const currentRide = await prisma.ride.findFirst({
    where: {
      ownerId: userId,
      status: Status.PENDING
    }
  })
  
  if (!currentRide) {
    res.status(400).json({ message: 'You do not have a pending ride' });

    return
  } else if (currentRide.groupId) {
    res.status(400).json({ message: 'You are already in a group' });

    return
  }

  const suggestions = await prisma.suggestion.findMany({
    where: {
      rideId: currentRide.id
    },
    include: {
      group: {
        include: {
          receivedInvites: {
            where: {
              senderRideId: currentRide.id
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      },
      route: true
    }
  });

  const withInvStatus = suggestions.map(s => ({
    ...s,
    inviteStatus: s.group?.receivedInvites?.[0]?.status ?? null
  }))

  res.json({
    data: withInvStatus,
    error: null
  });
}