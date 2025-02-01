import { Prisma, PrismaClient, Status } from "@prisma/client";
import prisma from "../prisma";
import { DefaultArgs } from "@prisma/client/runtime/library";

type PrismaTransactionClient = Omit<PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;;

export const getRoute = async (rides: Prisma.RideGetPayload<{
  select: {
    id: true;
    stops: true
  }
}>[], tx: PrismaTransactionClient) => {
  const rideIds = rides.map(ride => ride.id);

  const _route = await tx.route.findMany({
    where: {
      rides: {
        every: {
          id: {
            in: rideIds
          }
        },
        none: {
          id: {
            notIn: rideIds
          }
        }
      }
    },
    include: {
      rides: {
        select: {
          id: true
        }
      }
    }
  });

  const route = _route.find(route => route.rides.length === rideIds.length);

  if (route) {
    return route;
  } else {
    const solution = await solveVrp(rides);

    const route = await tx.route.create({
      data: {
        rides: {
          connect: rides.map(ride => ({
            id: ride.id
          }))
        },
        distance: solution.distance,
        duration: solution.completion_time,
        solution
      }
    });

    return route;
  }
};

export const generateSuggestions = async (ride: Prisma.RideGetPayload<{
  include: {
    stops: true
  }
}>, tx: PrismaTransactionClient) => {
    //TODO: Find a way to optimize this
  if (ride.groupId) {
    const group = await tx.group.findUnique({
      where: {
        id: ride.groupId
      },
      include: {
        rides: {
          select: {
            id: true,
            stops: true
          }
        }
      }
    })

    if (!group) {
      return;
    }

    const potenitalRides = await tx.ride.findMany({
      where: {
        status: Status.PENDING,
        groupId: null,
      },
      select: {
        id: true,
        stops: true
      }
    })

    await Promise.all(potenitalRides.map(async potentialRide => {
      const solution = await solveVrp([...group.rides, potentialRide]);

      const route = await tx.route.create({
        data: {
          rides: {
            connect: [ride, potentialRide].map(ride => ({
              id: ride.id
            }))
          },
          distance: solution.distance,
          duration: solution.completion_time,
          solution
        },
        select: {
          id: true
        }
      });

      await tx.suggestion.create({
        data: {
          rideId: potentialRide.id,
          routeId: route.id,
          groupId: group.id
        }
      });
    }));
  } else {
    const potentialGroups = await prisma.group.findMany({
      where: {
        status: Status.PENDING
      },
      select: {
        id: true,
        rides: {
          select: {
            id: true,
            stops: true
          }
        }
      }
    });

    await Promise.all(potentialGroups.map(async group => {
      const solution = await solveVrp([ride, ...group.rides]);

      const route = await tx.route.create({
        data: {
          rides: {
            connect: [ride, ...group.rides].map(ride => ({
              id: ride.id
            }))
          },
          distance: solution.distance,
          duration: solution.completion_time,
          solution
        },
        select: {
          id: true
        }
      });

      await tx.suggestion.create({
        data: {
          rideId: ride.id,
          routeId: route.id,
          groupId: group.id,
        }
      });
    }));
  }
};

const solveVrp = async (rides: Prisma.RideGetPayload<{
  select: {
    id: true;
    stops: true
  }
}>[]) => {
  const services = [] as any[], relations = [] as any[];

  for (let ride of rides) {
    const ids = [] as string[];

    for (let i = 0; i < ride.stops.length; i++) {
      const stop = ride.stops[i];

      const serviceId = `${ride.id}-${stop.id}`;
      ids.push(serviceId);

      services.push({
        id: serviceId,
        type: i === 0 ? "pickup" : i === ride.stops.length - 1 ? "delivery" : "service",
        name: stop.address,
        address: {
          location_id: serviceId,
          lat: stop.lat,
          lon: stop.lon
        }
      });
    }

    relations.push({
      type: "in_sequence",
      ids
    });
  }

  const body = {
    vehicles: [{
      vehicle_id: "ridemate",
      return_to_depot: false,
    }],
    services,
    relations
  };

  const res = await fetch("https://graphhopper.com/api/1/vrp?key=" + process.env.GRAPHHOPPER_API_KEY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })
    .then(res => {
      if (!res.ok) {
        console.log("Error while Solving Vrp", res, body);
        return;
      }

      return res.json();
    })
    .catch((e) => {
      console.log("Error while Solving Vrp", body, e);
    });

  return res.solution.routes[0];
};