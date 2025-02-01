import { Request, Response } from 'express';
import prisma from '../prisma';
import { InviteStatus, Status } from '@prisma/client';
import { PrismaClientValidationError } from '@prisma/client/runtime/library';
import { generateSuggestions } from '../services/route.service';

export const getRides = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const rides = await prisma.ride.findMany({
    where: {
      ownerId: userId
    },
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      group: {
        include: {
          route: true
        }
      },
      stops: true
    }
  });

  res.json({
    data: rides,
    error: null
  });
};

export const getCurrentRide = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const ride = await prisma.ride.findFirst({
    where: {
      ownerId: userId,
      status: Status.PENDING
    },
    include: {
      group: {
        include: {
          ownerRide: {
            select: {
              owner: {
                select: {
                  name: true
                }
              }
            },
          },
          rides: {
            select: {
              owner: {
                select: {
                  name: true
                }
              }
            }
          },
          route: true
        }
      },
      stops: true
    }
  });

  res.json({
    data: ride,
    error: null
  });
};

export const createRide = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const {
    stops,
    peopleCnt,
    femaleCnt,
    earliestDeparture: earliestDeparture,
    latestDeparture: latestDeparture
  } = req.body;
  
  if (
    typeof peopleCnt !== 'number' || isNaN(peopleCnt) || peopleCnt < 1
    || typeof femaleCnt !== 'number' || isNaN(femaleCnt)
    || !earliestDeparture || typeof earliestDeparture !== 'string'
    || !latestDeparture || typeof latestDeparture !== 'string'
    || new Date(earliestDeparture) > new Date(latestDeparture)
    || !stops || !Array.isArray(stops)
    || stops.some((stop: any) => typeof stop !== 'object' || !stop.lat || !stop.lng || !stop.address)
  ) {
    res.status(400).json({ message: 'Invalid body' });

    return;
  }

  const currentRide = await prisma.ride.findFirst({
    where: {
      ownerId: userId,
      status: Status.PENDING
    }
  });

  if (currentRide) {
    res.status(400).json({
      message: 'You already have a pending ride'
    });

    return;
  }

  await prisma.$transaction(async tx => {
    const ride = await prisma.ride.create({
      data: {
        ownerId: userId,
        femaleCnt,
        peopleCnt,
        earliestDep: earliestDeparture,
        latestDep: latestDeparture,
        stops: {
          createMany: {
            data: stops.map((stop, idx) => ({
              address: stop.address,
              lat: stop.lat,
              lon: stop.lng,
              stopOrder: idx
            }))
          }
        }
      },
      include: {
        stops: true
      }
    })

    await generateSuggestions(ride, tx)
  })
    .then(() => {
      res.json({
        data: null,
        error: null
      })
    })
    .catch((error) => {
      if (error instanceof PrismaClientValidationError) {
        console.log(error);

        res.status(400).json({
          message: 'Invalid body'
        });
      } else {
        console.error(error);

        res.status(500).json({
          message: 'Something went wrong'
        });
      }
    });
};

export const cancelRide = async (req: Request, res: Response) => {
  //TODO

  res.status(500).json({
    data: null,
    error: "Not implemented"
  });
};