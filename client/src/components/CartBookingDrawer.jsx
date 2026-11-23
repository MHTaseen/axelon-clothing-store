import React, { useState } from 'react';
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CheckCircle2,
  ShieldCheck,
  User,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';

export default function CartBookingDrawer({
  isOpen,
  onClose,
  cart,
  updateQuantity,
  removeFromCart,
  clearCart,
  clientId,
  clientName,
  setClientName,
  clientPhone,
  setClientPhone,
  clientEmail,
  setClientEmail
}) {
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedSlip, setConfirmedSlip] = useState(null);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryCharge = subtotal === 0 ? 0 : subtotal >= 3000 ? 0 : 120;
  const totalAmount = subtotal + deliveryCharge;

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          client: {
            name: clientName || 'Customer',
            phone: clientPhone,
            email: clientEmail,
            address,
            notes
          },
          items: cart,
          subtotal,
          deliveryCharge,
          totalAmount
        })
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setConfirmedSlip(data.order);
        clearCart();
      }
    } catch (err) {
      console.error('Booking order failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#060F24]/70 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl border-l border-[#B8844E]/40">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#0F2557] px-5 py-4 text-white border-b border-[#B8844E]/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-[#F2D5B1]" />
            <div>
              <h3 className="font-serif text-xl font-bold text-[#F2D5B1]">
                Shopping Cart & Booking Slip ({totalItems})
              </h3>
              <p className="text-[11px] text-white/75">
                Review all selected products & send your booking order to Admin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfirmedSlip(null);
              onClose();
            }}
            className="p-1.5 rounded-full text-white/80 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#FBF8F4]">
          {confirmedSlip ? (
            /* Confirmed Booking Slip Receipt */
            <div className="bg-white border-2 border-[#0F2557] p-5 space-y-4 shadow-md">
              <div className="text-center border-b border-dashed border-[#B8844E] pb-4 space-y-1">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="font-serif text-2xl font-bold text-[#0F2557]">
                  Booking Order Sent to Admin!
                </h4>
                <p className="text-xs font-mono font-bold text-[#9A6B3B]">
                  SLIP NO: {confirmedSlip.id}
                </p>
                <p className="text-[11px] text-navy-600">
                  {new Date(confirmedSlip.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="text-xs space-y-1 bg-[#FBF8F4] p-3 border border-[#DBBB97]/60">
                <p><strong>Client Name:</strong> {confirmedSlip.client.name}</p>
                <p><strong>Phone:</strong> {confirmedSlip.client.phone}</p>
                {confirmedSlip.client.email && <p><strong>Email:</strong> {confirmedSlip.client.email}</p>}
                <p><strong>Delivery Address:</strong> {confirmedSlip.client.address}</p>
                {confirmedSlip.client.notes && <p><strong>Notes:</strong> {confirmedSlip.client.notes}</p>}
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F2557]">
                  Booked Products
                </p>
                {confirmedSlip.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs border-b border-navy-100 pb-1.5">
                    <span>
                      {item.name} × <strong>{item.quantity}</strong>
                    </span>
                    <span className="font-bold">TK {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-xs pt-2 border-t border-dashed border-[#B8844E]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>TK {confirmedSlip.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charge</span>
                  <span>{confirmedSlip.deliveryCharge === 0 ? 'FREE' : `TK ${confirmedSlip.deliveryCharge}`}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-[#0F2557] pt-1">
                  <span>Total Amount</span>
                  <span>TK {confirmedSlip.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setConfirmedSlip(null);
                  onClose();
                }}
                className="w-full bg-[#0F2557] py-3 text-xs font-bold uppercase tracking-widest text-[#F2D5B1] hover:bg-[#060F24] transition"
              >
                Continue Shopping
              </button>
            </div>
          ) : cart.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <ShoppingBag className="h-12 w-12 text-[#B8844E] mx-auto opacity-70" />
              <h4 className="font-serif text-2xl font-bold text-[#0F2557]">Your Cart is Empty</h4>
              <p className="text-xs text-navy-600 max-w-xs mx-auto">
                Click "Add to Cart" on any product to build your order and send a booking slip to our Admin.
              </p>
            </div>
          ) : (
            <>
              {/* Added Products List */}
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 bg-white p-3 border border-[#DBBB97]/70 shadow-sm"
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-20 w-16 object-cover border border-navy-100 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-[#0F2557] truncate">
                          {item.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-navy-400 hover:text-red-600 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-[#DBBB97]">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-1.5 hover:bg-[#FBF6F0]"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-3 text-xs font-bold text-[#0F2557]">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-1.5 hover:bg-[#FBF6F0]"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm font-extrabold text-[#9A6B3B]">
                          TK {(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Booking Order Slip Summary */}
              <div className="bg-white border-2 border-dashed border-[#B8844E] p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#0F2557] border-b border-navy-100 pb-2">
                  <Receipt className="h-4 w-4 text-[#B8844E]" />
                  <span>AXELON Booking Slip Summary</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-navy-700">
                    <span>Total Items ({totalItems})</span>
                    <span className="font-semibold">TK {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-navy-700">
                    <span>Delivery Charge {subtotal >= 3000 ? '(Free Over TK 3,000)' : ''}</span>
                    <span className="font-semibold">
                      {deliveryCharge === 0 ? 'FREE' : `TK ${deliveryCharge}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-[#0F2557] pt-2 border-t border-navy-100">
                    <span>Total Payable</span>
                    <span>TK {totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Client Details Form to Send Booking Order */}
              <form onSubmit={handleSubmitBooking} className="bg-white border border-[#DBBB97] p-4 space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F2557]">
                  Your Details for Booking Order
                </h4>

                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Full Name *"
                    className="w-full border border-navy-200 pl-9 pr-3 py-2 text-xs text-navy-900 focus:border-[#0F2557] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                    <input
                      type="tel"
                      required
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="Phone Number *"
                      className="w-full border border-navy-200 pl-9 pr-3 py-2 text-xs text-navy-900 focus:border-[#0F2557] focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="Email (Optional)"
                      className="w-full border border-navy-200 pl-9 pr-3 py-2 text-xs text-navy-900 focus:border-[#0F2557] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-navy-400" />
                  <textarea
                    rows={2}
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Full Delivery Address *"
                    className="w-full border border-navy-200 pl-9 pr-3 py-2 text-xs text-navy-900 focus:border-[#0F2557] focus:outline-none"
                  />
                </div>

                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferred Size / Color / Note (Optional)"
                  className="w-full border border-navy-200 px-3 py-2 text-xs text-navy-900 focus:border-[#0F2557] focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#0F2557] py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-[#F2D5B1] hover:bg-[#060F24] transition shadow"
                >
                  {submitting ? 'Sending Booking Slip...' : `Send Booking Order (TK ${totalAmount.toLocaleString()})`}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[10px] text-navy-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Encrypted Booking Slip sent directly to AXELON Admin</span>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
