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
    if (!customer) throw new AppError('The customer was not found');

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!existentProducts.length)
      throw new AppError("Couldn't find any products with the given ids");

    const existentProductsIds = existentProducts.map(product => product.id);

    const any = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (any.length) throw new AppError(`Could not find product ${any[0].id}`);

    const outOfStok = products.filter(
      product =>
        existentProducts.filter(
          orderProduct => product.id === orderProduct.id,
        )[0].quantity < product.quantity,
    );

    if (outOfStok.length)
      throw new AppError(
        `Not enough quantity to order product ${outOfStok[0]}`,
      );

    const orderProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(
        existentProduct => existentProduct.id === product.id,
      )[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    const { order_products } = order;

    const orderProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existentProducts.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
