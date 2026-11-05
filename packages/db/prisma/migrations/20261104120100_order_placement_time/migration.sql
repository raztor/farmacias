-- HAND EDIT: orders.created_at is the moment the order is placed (R-DAT-11).
--
-- The draft row (the cart) becomes the placed order, so its created_at was the moment the cart
-- was opened: a cart kept open for days jumped ahead of orders confirmed and paid earlier in the
-- FIFO queue (D-18), in "Mis pedidos" and in the creation date shown to operators. When an order
-- leaves draft (confirm; a cancelled draft was never placed) this trigger re-stamps created_at
-- with the transaction time, the same instant as the confirm's updated_at and status event.
-- Prisma does not model triggers, so `migrate diff` neither creates nor drops it.

CREATE FUNCTION "orders_stamp_placement"() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."created_at" := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER "orders_stamp_placement"
BEFORE UPDATE OF "status" ON "orders"
FOR EACH ROW
WHEN (OLD."status" = 'draft' AND NEW."status" NOT IN ('draft', 'cancelled'))
EXECUTE FUNCTION "orders_stamp_placement"();
