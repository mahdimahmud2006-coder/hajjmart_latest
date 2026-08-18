<?php
namespace Database\Seeders;
use App\Models\RiskRule;
use Illuminate\Database\Seeder;
class RiskControlSeeder extends Seeder
{
    public function run(): void
    {
        $rules = [
            ['high_value_cod','High-value COD','order',25,['amount'=>15000],'Large COD exposure on a single order.'],
            ['cod_velocity','COD order velocity','order',30,['orders'=>3,'minutes'=>60],'Repeated COD orders from the same phone in a short window.'],
            ['cod_cancellation_history','COD cancellation history','order',25,['cancelled_orders'=>2,'days'=>90],'Phone has repeated cancelled/refused order history.'],
            ['address_variance','Multiple addresses','order',15,['addresses'=>3,'days'=>90],'Same phone is used across several delivery addresses.'],
            ['large_discount','Large discount','order',20,['percent'=>15],'Order discount is unusually large relative to subtotal.'],
            ['large_customer_due','Large customer due','order',15,['amount'=>10000],'Order leaves a high unpaid balance.'],
            ['offline_sync_delay','Delayed offline POS sync','order',20,['hours'=>12],'Offline POS transaction reached the server unusually late.'],
            ['duplicate_payment_reference','Duplicate payment reference','order',40,[],'Payment reference is already attached to another payment.'],
        ];
        foreach ($rules as [$key,$name,$domain,$weight,$config,$description]) {
            RiskRule::updateOrCreate(['key'=>$key], compact('name','domain','weight','config','description') + ['is_active'=>true]);
        }
    }
}
