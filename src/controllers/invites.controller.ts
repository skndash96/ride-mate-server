import { Request, Response } from 'express';
import prisma from '../prisma';
import { InviteStatus, Status } from '@prisma/client';
import { getRoute } from '../services/route.service';

export const getSentInvites = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const currentRide = await prisma.ride.findFirst({
    where: {
      ownerId: userId,
      status: Status.PENDING,
    }
  })

  if (!currentRide) {
    res.status(404).json({
      data: null,
      error: 'No pending ride found'
    });

    return;
  }

  const sentInvites = await prisma.invite.findMany({
    where: {
      senderRide: {
        id: currentRide.id
      }
    },
    include: {
      receiverGroup: {
        include: {
          suggestions: {
            where: {
              rideId: currentRide.id
            },
            select: {
              route: true
            }
          },
          ownerRide: {
            select: {
              owner: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  res.status(200).json({
    data: sentInvites.map(inv => {
      const newObj : any = inv
      newObj.route = inv.receiverGroup.suggestions[0]?.route.solution;
      delete newObj.receiverGroup.suggestions;

      return newObj;
    }),
    error: null
  });
}

export const getReceivedInvites = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const currentRide = await prisma.ride.findFirst({
    where: {
      ownerId: userId,
      status: Status.PENDING,
    },
    include: {
      group: true,
    }
  });

  if (!currentRide) {
    res.status(404).json({
      data: null,
      error: 'No pending ride found'
    });

    return;
  } else if (!currentRide.group || !currentRide.groupId) {
    res.status(400).json({
      data: null,
      error: 'You are not part of a group'
    });

    return;
  } else if (currentRide.id !== currentRide.group.ownerRideId) {
    res.status(400).json({
      data: null,
      error: 'You are not the owner of the group'
    });

    return;
  }

  const invites = await prisma.invite.findMany({
    where: {
      receiverGroupId: currentRide.groupId,
    },
    include: {
      senderRide: {
        include: {
          suggestions: {
            where: {
              groupId: currentRide.groupId
            },
            select: {
              route: true
            }
          },
          owner: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  res.status(200).json({
    data: invites.map(inv => {
      const newObj : any = inv
      newObj.route = inv.senderRide.suggestions[0]?.route.solution;
      delete newObj.senderRide.suggestions;

      return newObj;
    }),
    error: null
  });
};

export const sendInvite = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const { groupId: receiverGroupId } = req.body;

  const currentRide = await prisma.ride.findFirst({
    where: {
      ownerId: userId,
      status: Status.PENDING,
    }
  });

  if (!currentRide) {
    res.status(404).json({
      data: null,
      error: 'No pending ride found'
    });

    return;
  } else if (currentRide.groupId) {
    res.status(400).json({
      data: null,
      error: 'Ride is already part of a group'
    });

    return;
  }

  const receiverGroup = await prisma.group.findUnique({
    where: {
      id: receiverGroupId,
      status: Status.PENDING,
    },
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
  })

  if (!receiverGroup) {
    res.status(404).json({
      data: null,
      error: 'No group found'
    });

    return;
  } else if (receiverGroup.receivedInvites.find(invite => invite.senderRideId === currentRide.id)) {
    res.status(400).json({
      data: null,
      error: 'Invite already sent to this group'
    });

    return
  }

  await prisma.invite.create({
    data: {
      senderRideId: currentRide.id,
      receiverGroupId: receiverGroup.id,
    }
  });

  res.status(201).json({
    data: null,
    error: null
  });
};

export const acceptInvite = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const { inviteId } = req.params;

  if (!inviteId) {
    res.status(400).json({
      data: null,
      error: 'Invite ID is required'
    });

    return;
  }

  const currentRide = await prisma.ride.findFirst({
    where: {
      ownerId: userId,
      status: Status.PENDING
    }
  })

  if (!currentRide) {
    res.status(400).json({
      data: null,
      error: "No pending ride found"
    })

    return
  }

  const invite = await prisma.invite.findFirst({
    where: {
      id: inviteId,
    },
    include: {
      senderRide: {
        include: {
          stops: true,
          owner: {
            select: {
              name: true
            }
          }
        }
      },
      receiverGroup: {
        include: {
          rides: {
            include: {
              stops: true
            }
          }
        }
      }
    }
  });

  if (!invite) {
    res.status(404).json({
      data: null,
      error: 'Invite not found'
    });

    return;
  } else if (invite.receiverGroup.ownerRideId !== currentRide.id) {
    res.status(400).json({
      data: null,
      error: 'You are not the owner of the group'
    })

    return
  }

  await prisma.$transaction(async tx => {
    await tx.ride.update({
      where: {
        id: invite.senderRide.id,
      },
      data: {
        groupId: invite.receiverGroup.id
      }
    })

    await tx.invite.updateMany({
      where: {
        senderRideId: invite.senderRide.id,
        status: InviteStatus.PENDING
      },
      data: {
        declineReason: "Joined another group",
        status: InviteStatus.REVOKED
      }
    })

    const route = await getRoute([invite.senderRide, ...invite.receiverGroup.rides], tx);

    await tx.group.update({
      where: {
        id: invite.receiverGroup.id
      },
      data: {
        routeId: route.id,
        messages: {
          create: {
            text: `${invite.senderRide.owner.name} has joined your ride!`
          }
        }
      }
    });

    await tx.suggestion.deleteMany({
      where: {
        rideId: invite.senderRideId
      }
    });

    await tx.invite.update({
      where: {
        id: inviteId
      },
      data: {
        status: InviteStatus.ACCEPTED
      }
    });
  }).then(() => {
    res.json({
      data: null,
      error: null
    });
  }).catch(error => {
    res.status(500).json({
      data: null,
      error: 'Failed to decline invite'
    });
  });
};

export const declineInvite = async (req: Request, res: Response) => {
  const userId = req.userId!;

  const { inviteId } = req.params;
  const { reason } = req.body;

  if (!inviteId) {
    res.status(400).json({
      data: null,
      error: 'Invite ID is required'
    });

    return;
  } else if (!reason) {
    res.status(400).json({
      data: null,
      error: 'Reason is required'
    });

    return;
  } else if (reason.length > 255) {
    res.status(400).json({
      data: null,
      error: 'Reason is too long'
    });

    return;
  }

  const currentRide = await prisma.ride.findFirst({
    where: {
      ownerId: userId,
      status: Status.PENDING
    }
  })

  if (!currentRide) {
    res.status(404).json({
      data: null,
      error: 'No pending ride found'
    });

    return;
  }

  const invite = await prisma.invite.findFirst({
    where: {
      id: inviteId
    },
    include: {
      receiverGroup: true
    }
  });

  if (!invite) {
    res.status(404).json({
      data: null,
      error: 'Invite not found'
    });

    return;
  } else if (invite.receiverGroup.ownerRideId !== currentRide.id) {
    res.status(403).json({
      data: null,
      error: 'You are not the owner of the group'
    });

    return;
  }

  await prisma.invite.update({
    where: {
      id: inviteId
    },
    data: {
      declineReason: reason,
      status: InviteStatus.DECLINED
    }
  });

  res.json({
    data: null,
    error: null
  });
};