import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { CreatePaymentInput, CreatePaymentOutput } from './dtos/create-payment.dto';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>
  ) {}

  async createPayment(
    owner: User,
    { transactionId, restaurantId }: CreatePaymentInput
  ): Promise<CreatePaymentOutput> {
    try {
      const restaurant = await this.restaurants.findOne(restaurantId);
      if (!restaurant) {
        return {
          ok: false,
          error: 'restaurant not found.',
        };
      }
      if (restaurant.ownerId !== owner.id) {
        return {
          ok: false,
          error: 'You are not allowed to do this.',
        };
      }
      await this.payments.save(
        this.payments.create({
          transactionId,
          user: owner,
          restaurant,
        })
      );
      return {
        ok: true,
      };
    } catch {
      return {
        ok: false,
        error: 'Could not create a payment.',
      };
    }
  }
}
