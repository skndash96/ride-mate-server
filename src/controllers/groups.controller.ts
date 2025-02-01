import { Request, Response } from 'express';
import prisma from '../prisma';
import { Status } from '@prisma/client';
import { generateSuggestions, getRoute } from '../services/route.service';

export const createGroup = async (req: Request, res: Response) => {
  const userId = req.userId!

  const {
    capacity,
    vehicleType
  } = req.body

  if (!capacity || !vehicleType) {
    res.status(400).json({
      error: 'capacity and vehicleType are required'
    })

    return
  }

  const currentRide = await prisma.ride.findFirst({
    where: {
      ownerId: userId,
      status: Status.PENDING
    },
    include: {
      owner: true,
      stops: true
    }
  })

  if (!currentRide) {
    res.status(400).json({
      error: 'You do not have a pending ride'
    })

    return
  } else if (currentRide.groupId) {
    res.status(400).json({
      error: 'You are already in a group'
    })
  }

  try {
    await prisma.$transaction(async tx => {
      const route = await getRoute([currentRide], tx)

      const group = await tx.group.create({
        data: {
          ownerRideId: currentRide.id,
          capacity,
          vehicleType,
          routeId: route.id,
          rides: {
            connect: {
              id: currentRide.id
            }
          },
          messages: {
            create: {
              text: `Ride owner ${currentRide.owner.name}`
            }
          }
        },
        select: {
          ownerRide: {
            include: {
              stops: true
            }
          }
        }
      })

      await generateSuggestions(group.ownerRide, tx)
    })


    res.json({
      data: null,
      error: null
    })
  } catch (e) {
    console.error(e)

    res.status(500).json({
      data: null,
      error: 'Failed to create group'
    })
  }
}

export const markGroupComplete = async (req: Request, res: Response) => {
  res.status(501).json({
    data: null,
    error: 'Not implemented'
  })
}

export const cancelGroup = async (req: Request, res: Response) => {
  res.status(501).json({
    data: null,
    error: 'Not implemented'
  })
}
