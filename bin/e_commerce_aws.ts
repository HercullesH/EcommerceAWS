#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { EcommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stack'
import { EventsDdbStack } from '../lib/eventsDdb-stack';
import { OrdersAppLayersStack } from '../lib/ordersAppLayers-stack';
import { OrdersAppStack } from '../lib/ordersApp-stack';
import { InvoiceWSApiStack } from '../lib/invoiceWSApi-stack';
import { InvoicesAppLayersStack } from '../lib/invoicesAppLayers-stack'
import { AuditEventBusStack } from '../lib/auditEventBus-stack'

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

const auditEventBus = new AuditEventBusStack(app, 'AuditEvents', {
    tags: {
        const: 'Audit',
        team: 'Herculles'
    },
    env: env
})

const productsAppLayersStack = new ProductsAppLayersStack(app, 'ProductsAppLayers', {
    tags: tags,
    env: env
})

const eventsDdbStack = new EventsDdbStack(app, 'EventsDdb', {
    tags: tags,
    env: env
})

const productsAppStack = new ProductsAppStack(app, 'ProductsApp', {
    eventsDdb: eventsDdbStack.table,
    tags: tags,
    env: env
})

productsAppStack.addDependency(productsAppLayersStack)
productsAppStack.addDependency(eventsDdbStack)

const ordersAppLayersStack = new OrdersAppLayersStack(app, 'OrdersAppLayers', {
    tags: tags,
    env: env
})

const ordersAppStack = new OrdersAppStack(app, 'OrdersApp', {
    tags: tags,
    env: env,
    productsDdb: productsAppStack.productsDdb,
    eventsDdb: eventsDdbStack.table,
    auditBus: auditEventBus.bus
})

ordersAppStack.addDependency(productsAppStack)
ordersAppStack.addDependency(ordersAppLayersStack)
ordersAppStack.addDependency(eventsDdbStack)
ordersAppStack.addDependency(auditEventBus)

const eCommerceApiStack = new EcommerceApiStack(app, 'EcommerceApi', {
    productsFetchHandler: productsAppStack.productsFetchHandler,
    productsAdminHandler: productsAppStack.productsAdminHandler,
    ordersHandler: ordersAppStack.ordersHandler,
    orderEventsFetchHandler: ordersAppStack.orderEventsFetchHandler,
    tags: tags,
    env: env
})

eCommerceApiStack.addDependency(productsAppStack)
eCommerceApiStack.addDependency(ordersAppStack)

const invoicesAppLayersStack = new InvoicesAppLayersStack(app, 'InvoicesAppLayer', {
    tags: {
        cost: 'InvoiceApp',
        team: 'Herculles'
    },
})

const invoiceWSApiStack = new InvoiceWSApiStack(app, 'InvoiceApi', {
    eventsDdb: eventsDdbStack.table,
    auditBus: auditEventBus.bus,
    tags: {
        cost: 'InvoiceApp',
        team: 'Herculles'
    },
    env: env
})

invoiceWSApiStack.addDependency(invoicesAppLayersStack)
invoiceWSApiStack.addDependency(eventsDdbStack)
invoiceWSApiStack.addDependency(auditEventBus)