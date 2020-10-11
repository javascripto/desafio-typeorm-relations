import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('C ustomer does not exists');
    }
    const foundProducts = await this.productsRepository.findAllById(products);

    if (!products.length) {
      throw new AppError("You can't create and order without products");
    }

    const productsIds = foundProducts.map(({ id }) => id);
    const inexistentProducts = products.filter(
      ({ id }) => !productsIds.includes(id),
    );

    if (inexistentProducts.length) {
      throw new AppError(
        `Products not found: ${inexistentProducts.join(', ')}`,
      );
    }
    const unavaliableProducts = products.filter(
      ({ quantity, id }) =>
        foundProducts.find(({ id: _id }) => id === _id)!.quantity < quantity,
    );

    if (unavaliableProducts.length) {
      throw new AppError(
        `Some products are unavailable in quantity: ${unavaliableProducts
          .map(p => p.id)
          .join(', ')}`,
      );
    }
    const orderProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: foundProducts.find(({ id }) => id === product.id)!.price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    const orderProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        foundProducts.find(({ id }) => product.id === id)!.quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProductsQuantity);
    return order;
  }
}

export default CreateOrderService;
