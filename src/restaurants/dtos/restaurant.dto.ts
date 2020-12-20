import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { CoreOutput } from 'src/common/dtos/output.dto';
import { Restaurant } from '../entities/restaurant.entity';
import { RestaurantsInput } from './restaurants.dto';

@InputType()
export class RestaurantInput {
  @Field(() => Int)
  restaurantId: number;
}

@ObjectType()
export class RestaurantOutput extends CoreOutput {
  @Field(() => Restaurant, { nullable: true })
  restaurant?: Restaurant;
}
