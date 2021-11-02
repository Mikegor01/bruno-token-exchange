import { get, groupBy, reject, maxBy, minBy } from "lodash";
import { createSelector } from "reselect";
import moment from "moment";
import { ETHER_ADDRESS, GREEN, RED, tokens, ether } from "../helpers";

//Ether,Token rounding utility
export const formatBalance = (balance) => {
  const precision = 100; //2 decimal places

  balance = ether(balance);
  balance = Math.round(balance * precision) / precision; // 2 decimal places

  return balance;
};

const account = (state) => get(state, "web3.account");
export const accountSelector = createSelector(account, (a) => a);

const web3 = (state) => get(state, "web3.connection");
export const web3Selector = createSelector(web3, (w) => w);

const tokenLoaded = (state) => get(state, "token.loaded", false);
export const tokenLoadedSelector = createSelector(tokenLoaded, (tl) => tl);

const token = (state) => get(state, "token.contract");
export const tokenSelector = createSelector(token, (t) => t);

const exchangeLoaded = (state) => get(state, "exchange.loaded", false);
export const exchangeLoadedSelector = createSelector(
  exchangeLoaded,
  (el) => el
);

const exchange = (state) => get(state, "exchange.contract");
export const exchangeSelector = createSelector(exchange, (e) => e);

export const contractsLoadedSelector = createSelector(
  tokenLoaded,
  exchangeLoaded,
  (tl, el) => tl && el
);

//All orders
const allOrdersLoaded = (state) =>
  get(state, "exchange.allOrders.loaded", false);
const allOrders = (state) => get(state, "exchange.allOrders.data", []);

//Cancelled orders
const cancelledOrdersLoaded = (state) =>
  get(state, "exchange.cancelledOrders.loaded", false);
export const cancelleddOrdersLoadedSelector = createSelector(
  cancelledOrdersLoaded,
  (loaded) => loaded
);
const cancelledOrders = (state) =>
  get(state, "exchange.cancelledOrders.data", []);
export const cancelledOrdersSelector = createSelector(
  cancelledOrders,
  (o) => o
);

//Filled Orders
const filledOrdersLoaded = (state) =>
  get(state, "exchange.filledOrders.loaded", false);
export const filledOrdersLoadedSelector = createSelector(
  filledOrdersLoaded,
  (loaded) => loaded
);

const filledOrders = (state) => get(state, "exchange.filledOrders.data", []);
export const filledOrdersSelector = createSelector(filledOrders, (orders) => {
  //Sort orders by date ascending or price comparison
  orders = orders.sort((a, b) => a.timestamp - b.timestamp);
  // Decorate orders
  orders = decorateFilledOrders(orders);

  //Sort orders by date descending
  orders = orders.sort((a, b) => b.timestamp - a.timestamp);
  return orders;
});

const decorateFilledOrders = (orders) => {
  //Tracking previous order to compare history
  let previousOrder = orders[0];
  return orders.map((order) => {
    order = decorateOrder(order);
    order = decorateFilledOrder(order, previousOrder);
    previousOrder = order; //Update the previous order once it's decorated
    return order;
  });
};

const decorateOrder = (order) => {
  let etherAmount;
  let tokenAmount;

  if (order.tokenGive === "0x0000000000000000000000000000000000000000") {
    etherAmount = order.amountGive;
    tokenAmount = order.amountGet;
  } else {
    etherAmount = order.amountGet;
    tokenAmount = order.amountGive;
  }

  const precision = 10000;
  let tokenPrice = etherAmount / tokenAmount;
  tokenPrice = Math.round(tokenPrice * precision) / precision;

  return {
    ...order,
    etherAmount: ether(etherAmount),
    tokenAmount: tokens(tokenAmount),
    tokenPrice,
    formattedTimestamp: moment.unix(order.timestamp).format("h:mm:ss a M/D"),
  };
};

const decorateFilledOrder = (order, previousOrder) => {
  return {
    ...order,
    tokenPriceClass: tokenPriceClass(order.tokenPrice, order.id, previousOrder),
  };
};

const tokenPriceClass = (tokenPrice, orderid, previousOrder) => {
  //Show green price if only one order exists
  if (previousOrder.id === orderid) {
    return GREEN;
  }
  //Green price if order price higher than previous order
  //Red price if order price is lower than previous order
  if (previousOrder.tokenPrice <= tokenPrice) {
    return GREEN; //success
  } else {
    return RED; //danger
  }
};

const openOrders = (state) => {
  const all = allOrders(state);
  const filled = filledOrders(state);
  const cancelled = cancelledOrders(state);

  const openOrders = reject(all, (order) => {
    const orderFilled = filled.some((o) => o.id === order.id);
    const orderCancelled = cancelled.some((o) => o.id === order.id);
    return orderFilled || orderCancelled;
  });
  return openOrders;
};

const orderBookLoaded = (state) =>
  cancelledOrdersLoaded(state) &&
  filledOrdersLoaded(state) &&
  allOrdersLoaded(state);
export const orderBookLoadedSelector = createSelector(
  orderBookLoaded,
  (loaded) => loaded
);

//Create the order book
export const orderBookSelector = createSelector(openOrders, (orders) => {
  //Decorate orders
  orders = decorateOrderBookOrders(orders);
  //Group by orderType
  orders = groupBy(orders, "orderType");
  // Fetch buy orders
  const buyOrders = get(orders, "buy", []);
  //Sort orders by token price
  orders = {
    ...orders,
    buyOrders: buyOrders.sort((a, b) => b.tokenPrice - a.tokenPrice),
  };
  // Fetch sell orders
  const sellOrders = get(orders, "sell", []);
  //Sort orders by token price
  orders = {
    ...orders,
    sellOrders: sellOrders.sort((a, b) => b.tokenPrice - a.tokenPrice),
  };
  return orders;
});

const decorateOrderBookOrders = (orders) => {
  return orders.map((order) => {
    order = decorateOrder(order);
    order = decorateOrderBookOrder(order);
    return order;
  });
};

const decorateOrderBookOrder = (order) => {
  const orderType = order.tokenGive === ETHER_ADDRESS ? "buy" : "sell";
  return {
    ...order,
    orderType,
    orderTypeClass: orderType === "buy" ? GREEN : RED,
    orderFillAction: orderType === "buy" ? "sell" : "buy",
  };
};

export const myFilledOrdersLoadedSelector = createSelector(
  filledOrdersLoaded,
  (loaded) => loaded
);

export const myFilledOrdersSelector = createSelector(
  account,
  filledOrders,
  (account, orders) => {
    //Filter and find our orders
    orders = orders.filter((o) => o.user === account || o.userFill === account);
    //Sort by date ascending
    orders = orders.sort((a, b) => a.timestamp - b.timestamp);
    //Decorate orders
    orders = decorateMyFilledOrders(orders, account);
    return orders;
  }
);

const decorateMyFilledOrders = (orders) => {
  return orders.map((order) => {
    order = decorateOrder(order);
    order = decorateMyFilledOrder(order, account);
    return order;
  });
};

const decorateMyFilledOrder = (order, account) => {
  const myOrder = order.user === account;

  let orderType;
  if (myOrder) {
    orderType = order.tokenGive === ETHER_ADDRESS ? "buy" : "sell";
  } else {
    orderType = order.tokenGive === ETHER_ADDRESS ? "sell" : "buy";
  }

  return {
    ...order,
    orderType,
    orderTypeClass: orderType === "buy" ? GREEN : RED,
    orderSign: orderType === "buy" ? "+" : "-",
  };
};

export const myOpenOrdersLoadedSelector = createSelector(
  orderBookLoaded,
  (loaded) => loaded
);

export const myOpenOrdersSelector = createSelector(
  account,
  openOrders,
  (account, orders) => {
    //Filter orders by current account
    orders = orders.filter((o) => o.user === account);
    //Decorate orders
    orders = decorateMyOpenOrders(orders);
    //Sort orders by date descending
    orders = orders.sort((a, b) => b.timestamp - a.timestamp);
    return orders;
  }
);

const decorateMyOpenOrders = (orders, account) => {
  return orders.map((order) => {
    order = decorateOrder(order);
    order = decorateMyOpenOrder(order, account);
    return order;
  });
};

const decorateMyOpenOrder = (order, account) => {
  let orderType = order.tokenGive === ETHER_ADDRESS ? "buy" : "sell";

  return {
    ...order,
    orderType,
    orderTypeClass: orderType === "buy" ? GREEN : RED,
  };
};

export const priceChartLoadedSelector = createSelector(
  filledOrdersLoaded,
  (loaded) => loaded
);

export const priceChartSelector = createSelector(filledOrders, (orders) => {
  //Sort orders by date descending
  orders = orders.sort((a, b) => b.timestamp - a.timestamp);
  //Decorate orders
  orders = orders.map((o) => decorateOrder(o));
  //Get last 2 prices for final price and change
  let secondLastOrder, lastOrder;
  [secondLastOrder, lastOrder] = orders.slice(orders.length - 2, orders.length);
  // Get lastOrder price
  const lastPrice = get(lastOrder, "tokenPrice", 0);
  // Get second last price
  const secondLastPrice = get(secondLastOrder, "tokenPrice", 0);

  return {
    lastPrice,
    lastPriceChange: lastPrice >= secondLastPrice ? "+" : "-",
    series: [
      {
        data: buildGraphData(orders),
      },
    ],
  };
});

const buildGraphData = (orders) => {
  //Group orders by the hour
  orders = groupBy(orders, (o) =>
    moment.unix(o.timestamp).startOf("hour").format()
  );
  // Get each hour where data exists
  const hours = Object.keys(orders);
  //Build the graph series
  const graphData = hours.map((hour) => {
    //Fetch all the orders from the current hour
    const group = orders[hour];
    //Calculate the price values - ohlc
    const open = group[0]; //the first order
    const high = maxBy(group, "tokenPrice"); // high price
    const low = minBy(group, "tokenPrice"); // low price
    const close = group[group.length - 1]; // close price

    return {
      x: new Date(hour),
      y: [open.tokenPrice, high.tokenPrice, low.tokenPrice, close.tokenPrice],
    };
  });

  return graphData;
};

const orderCancelling = (state) =>
  get(state, "exchange.orderCancelling", false);
export const orderCancellingSelector = createSelector(
  orderCancelling,
  (status) => status
);

const orderFilling = (state) => get(state, "exchange.orderFilling", false);
export const orderFillingSelector = createSelector(
  orderFilling,
  (status) => status
);

//Balances
const balancesLoading = (state) => get(state, "exchange.balancesLoading", true);
export const balancesLoadingSelector = createSelector(
  balancesLoading,
  (status) => status
);

const etherBalance = (state) => get(state, "web3.balance", 0);
export const etherBalanceSelector = createSelector(etherBalance, (balance) => {
  return formatBalance(balance);
});

const tokenBalance = (state) => get(state, "token.balance", 0);
export const tokenBalanceSelector = createSelector(tokenBalance, (balance) => {
  return formatBalance(balance);
});

const exchangeEtherBalance = (state) => get(state, "exchange.etherBalance", 0);
export const exchangeEtherBalanceSelector = createSelector(
  exchangeEtherBalance,
  (balance) => {
    return formatBalance(balance);
  }
);

const exchangeTokenBalance = (state) => get(state, "exchange.tokenBalance", 0);
export const exchangeTokenBalanceSelector = createSelector(
  exchangeTokenBalance,
  (balance) => {
    return formatBalance(balance);
  }
);

const etherDepositAmount = (state) =>
  get(state, "exchange.etherDepositAmount", null);
export const etherDepositAmountSelector = createSelector(
  etherDepositAmount,
  (amount) => amount
);

const etherWithdrawAmount = (state) =>
  get(state, "exchange.etherWithdrawAmount", null);
export const etherWithdrawAmountSelector = createSelector(
  etherWithdrawAmount,
  (amount) => amount
);

const tokenDepositAmount = (state) =>
  get(state, "exchange.tokenDepositAmount", null);
export const tokenDepositAmountSelector = createSelector(
  tokenDepositAmount,
  (amount) => amount
);

const tokenWithdrawAmount = (state) =>
  get(state, "exchange.tokenWithdrawAmount", null);
export const tokenWithdrawAmountSelector = createSelector(
  tokenWithdrawAmount,
  (amount) => amount
);

const buyOrder = (state) => get(state, "exchange.buyOrder", {});
export const buyOrderSelector = createSelector(buyOrder, (order) => order);

const sellOrder = (state) => get(state, "exchange.sellOrder", {});
export const sellOrderSelector = createSelector(sellOrder, (order) => order);
