#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { EcommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stack'

//comando 'cdk bootstrap' execute apenas uma vez

const app = new cdk.App();

const env: cdk.Environment = {
  account: '524684505634',
  region: 'us-east-1'
}

const tags = {
  cost: 'ECommerce',
  team: 'SiecolaCode'
}

const productsAppLayersStack = new ProductsAppLayersStack(app, 'ProductsAppLayers', {
  tags: tags,
  env: env
})

const productsAppStack = new ProductsAppStack(app, 'ProductsApp', {
  tags: tags,
  env: env
})

productsAppStack.addDependency(productsAppLayersStack)

const eCommerceApiStack = new EcommerceApiStack(app, 'EcommerceApi', {
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  tags: tags,
  env: env
})
eCommerceApiStack.addDependency(productsAppStack)